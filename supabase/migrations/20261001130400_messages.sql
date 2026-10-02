-- re_form platform · direct messages (PRD module 5)
-- One-to-one conversations. Messages are private to the two participants; admins can open a
-- conversation only after it is reported, and every such access is written to the audit log (DM-6).

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create index conversation_participants_profile_idx on public.conversation_participants (profile_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body            text not null default '' check (length(body) <= 4000),
  attachment_path text,
  attachment_name text,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  constraint messages_not_empty check (length(trim(body)) > 0 or attachment_path is not null or deleted_at is not null)
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.message_reports (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id      uuid references public.messages (id) on delete set null,
  reporter_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason          text not null default '' check (length(reason) <= 2000),
  status          text not null default 'open' check (status in ('open', 'reviewed')),
  created_at      timestamptz not null default now(),
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_participant(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = target and p.profile_id = auth.uid()
  )
$$;

-- Who may message whom mirrors who may see whom: same school, or anyone on the re_form team.
create function public.can_message(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target <> auth.uid()
    and public.current_app_role() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = target and p.deactivated_at is null
        and (public.is_staff() or p.role in ('staff', 'admin') or p.school_id = public.current_school_id())
    )
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = target)
         or (b.blocker_id = target and b.blocked_id = auth.uid())
    )
$$;

create function public.can_post(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_participant(target_conversation) and not exists (
    select 1 from public.conversation_participants other
    join public.user_blocks b
      on (b.blocker_id = other.profile_id and b.blocked_id = auth.uid())
      or (b.blocker_id = auth.uid() and b.blocked_id = other.profile_id)
    where other.conversation_id = target_conversation and other.profile_id <> auth.uid()
  )
$$;

revoke all on function public.is_participant(uuid) from public;
revoke all on function public.can_message(uuid)    from public;
revoke all on function public.can_post(uuid)       from public;
grant execute on function public.is_participant(uuid) to authenticated;
grant execute on function public.can_message(uuid)    to authenticated;
grant execute on function public.can_post(uuid)       to authenticated;

-- Find or create the one-to-one conversation with someone (DM-1).
create function public.start_conversation(target uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
  created uuid;
begin
  if not public.can_message(target) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select p1.conversation_id into existing
  from public.conversation_participants p1
  join public.conversation_participants p2 on p2.conversation_id = p1.conversation_id
  where p1.profile_id = auth.uid() and p2.profile_id = target
    and (select count(*) from public.conversation_participants c where c.conversation_id = p1.conversation_id) = 2
  limit 1;
  if existing is not null then return existing; end if;

  insert into public.conversations default values returning id into created;
  insert into public.conversation_participants (conversation_id, profile_id)
  values (created, auth.uid()), (created, target);
  return created;
end
$$;

-- Unread counts for the conversation list and the nav badge (DM-2).
create function public.unread_counts()
returns table (conversation_id uuid, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.conversation_id, count(m.id)
  from public.conversation_participants p
  join public.messages m on m.conversation_id = p.conversation_id
  where p.profile_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.created_at > p.last_read_at
    and m.deleted_at is null
  group by p.conversation_id
$$;

-- Admins open a reported conversation; the access is logged (DM-6).
create function public.admin_read_reported_conversation(target_report uuid)
returns table (id uuid, sender_id uuid, body text, attachment_name text, created_at timestamptz, deleted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select r.conversation_id into conv from public.message_reports r where r.id = target_report;
  if conv is null then raise exception 'unknown report' using errcode = 'P0002'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'conversation.read_after_report', 'conversation', conv::text,
          jsonb_build_object('report_id', target_report));

  return query
  select m.id, m.sender_id, m.body, m.attachment_name, m.created_at, m.deleted_at
  from public.messages m where m.conversation_id = conv order by m.created_at;
end
$$;

revoke all on function public.start_conversation(uuid) from public;
revoke all on function public.unread_counts() from public;
revoke all on function public.admin_read_reported_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.unread_counts() to authenticated;
grant execute on function public.admin_read_reported_conversation(uuid) to authenticated;

create function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_participants set last_read_at = new.created_at
  where conversation_id = new.conversation_id and profile_id = new.sender_id;
  return new;
end
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.user_blocks               enable row level security;
alter table public.message_reports           enable row level security;

revoke all on public.conversations, public.conversation_participants, public.messages,
  public.user_blocks, public.message_reports from anon;
revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_participants from authenticated;
grant update (last_read_at) on public.conversation_participants to authenticated;
revoke update on public.messages from authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;
revoke update on public.message_reports from authenticated;
grant update (status, reviewed_by, reviewed_at) on public.message_reports to authenticated;

create policy "conversations: participants read"
  on public.conversations for select to authenticated
  using (public.is_participant(id));

create policy "participants: participants read"
  on public.conversation_participants for select to authenticated
  using (public.is_participant(conversation_id));

create policy "participants: mark own as read"
  on public.conversation_participants for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "messages: participants read"
  on public.messages for select to authenticated
  using (public.is_participant(conversation_id));

create policy "messages: participants send unless blocked"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.can_post(conversation_id) and deleted_at is null and edited_at is null);

create policy "messages: senders edit or delete their own"
  on public.messages for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

create policy "blocks: see own"
  on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "blocks: block as yourself"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "blocks: unblock your own"
  on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create policy "reports: participants report"
  on public.message_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.is_participant(conversation_id) and status = 'open');

create policy "reports: reporters and admins read"
  on public.message_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "reports: admins resolve"
  on public.message_reports for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Storage: private "messages" bucket; path = <conversation id>/<random>-<file name>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messages', 'messages', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do nothing;

create policy "message objects: participants upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'messages' and public.can_post(public.try_uuid((storage.foldername(name))[1])));

create policy "message objects: participants read"
  on storage.objects for select to authenticated
  using (bucket_id = 'messages' and public.is_participant(public.try_uuid((storage.foldername(name))[1])));

-- Live delivery (DM-3)
alter publication supabase_realtime add table public.messages;
