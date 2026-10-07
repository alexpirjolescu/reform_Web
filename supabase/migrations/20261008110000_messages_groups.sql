-- re_form platform · messages, round two
-- Group chats like on WhatsApp (name, photo, description, admins, members, settings, leaving),
-- polls, replies, reactions, pinned messages, stickers, GIFs (GIPHY, rated G) and files sent from
-- the resource library (personal files are shared with the people in the chat automatically).

-- ===========================================================================
-- Conversations: one to one, or a group
-- ===========================================================================

alter table public.conversations
  add column kind             text not null default 'direct' check (kind in ('direct', 'group')),
  add column title            text check (title is null or length(trim(title)) between 1 and 80),
  add column description      text not null default '' check (length(description) <= 500),
  add column photo_path       text check (photo_path is null or photo_path not like '%..%'),
  add column created_by       uuid references public.profiles (id) on delete set null,
  add column only_admins_send boolean not null default false,
  add column only_admins_edit boolean not null default false,
  add constraint conversations_group_title check (kind = 'direct' or title is not null);

comment on column public.conversations.only_admins_send is 'Group setting: only admins can send messages.';
comment on column public.conversations.only_admins_edit is 'Group setting: only admins can change the name, photo, description and pins.';

alter table public.conversation_participants
  add column role      text not null default 'member' check (role in ('member', 'admin')),
  add column joined_at timestamptz not null default now(),
  add column muted     boolean not null default false;

grant update (muted) on public.conversation_participants to authenticated;

-- ===========================================================================
-- Messages: kinds, replies, files from the library, GIFs, stickers, pins
-- ===========================================================================

alter table public.messages
  add column kind            text not null default 'text' check (kind in ('text', 'sticker', 'gif', 'poll', 'system', 'resource')),
  add column reply_to        uuid references public.messages (id) on delete set null,
  add column library_file_id uuid references public.library_files (id) on delete set null,
  add column gif             jsonb check (gif is null or (gif ->> 'url') ~ '^https://(media[0-9]*|i)\.giphy\.com/'),
  add column sticker         text check (sticker is null or sticker ~ '^[a-z0-9-]{1,40}$'),
  add column system          jsonb,
  add column pinned_at       timestamptz,
  add column pinned_by       uuid references public.profiles (id) on delete set null;

alter table public.messages drop constraint messages_not_empty;
alter table public.messages add constraint messages_has_content check (
  deleted_at is not null
  or (kind = 'text' and (length(trim(body)) > 0 or attachment_path is not null))
  or (kind = 'sticker' and sticker is not null)
  or (kind = 'gif' and gif is not null)
  or kind in ('poll', 'system', 'resource')
);

create index messages_reply_idx on public.messages (reply_to);
create index messages_pinned_idx on public.messages (conversation_id) where pinned_at is not null;

-- A reply answers a message of the same conversation.
create function public.check_message_reply()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reply_to is not null and not exists (
    select 1 from public.messages m where m.id = new.reply_to and m.conversation_id = new.conversation_id
  ) then
    raise exception 'a reply must answer a message of the same conversation' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger messages_check_reply
  before insert on public.messages
  for each row execute function public.check_message_reply();

-- ===========================================================================
-- Reactions and polls
-- ===========================================================================

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji      text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id, emoji)
);

create index message_reactions_profile_idx on public.message_reactions (profile_id);

create table public.polls (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null unique references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  question        text not null check (length(trim(question)) between 1 and 300),
  multiple        boolean not null default false,
  closed_at       timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index polls_conversation_idx on public.polls (conversation_id);

create table public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.polls (id) on delete cascade,
  label    text not null check (length(trim(label)) between 1 and 100),
  position integer not null default 0
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, profile_id)
);

create index poll_votes_poll_idx on public.poll_votes (poll_id, profile_id);

-- ===========================================================================
-- Helpers
-- ===========================================================================

create function public.is_group_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = target and p.profile_id = auth.uid() and p.role = 'admin'
  )
$$;

-- Posting: in a one-to-one chat, nobody blocked the other; in a group, admins-only groups need an admin.
create or replace function public.can_post(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_participant(target_conversation) and (
    case (select c.kind from public.conversations c where c.id = target_conversation)
      when 'group' then
        not (select c.only_admins_send from public.conversations c where c.id = target_conversation)
        or public.is_group_admin(target_conversation)
      else not exists (
        select 1 from public.conversation_participants other
        join public.user_blocks b
          on (b.blocker_id = other.profile_id and b.blocked_id = auth.uid())
          or (b.blocker_id = auth.uid() and b.blocked_id = other.profile_id)
        where other.conversation_id = target_conversation and other.profile_id <> auth.uid()
      )
    end
  )
$$;

-- Group details change: admins always, members too unless the group is set to admins only.
create function public.can_edit_group(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    join public.conversation_participants p on p.conversation_id = c.id and p.profile_id = auth.uid()
    where c.id = target and (p.role = 'admin' or not c.only_admins_edit)
  )
$$;

-- Notes in the chat for what happened in the group ("Ana added Matei").
create function public.post_group_event(target uuid, payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.messages (conversation_id, sender_id, kind, system, body)
  values (target, auth.uid(), 'system', payload, '')
$$;

revoke all on function public.post_group_event(uuid, jsonb) from public, anon, authenticated;

-- ===========================================================================
-- Group actions
-- ===========================================================================

create function public.create_group(group_title text, members uuid[], group_description text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created uuid;
  member uuid;
begin
  if public.current_app_role() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(members, 1), 0) = 0 or array_length(members, 1) > 256 then
    raise exception 'a group needs between 1 and 256 other members' using errcode = '22023';
  end if;
  foreach member in array members loop
    if not public.can_message(member) then
      raise exception 'not allowed to add %', member using errcode = '42501';
    end if;
  end loop;

  insert into public.conversations (kind, title, description, created_by)
  values ('group', left(trim(group_title), 80), left(coalesce(group_description, ''), 500), auth.uid())
  returning id into created;
  insert into public.conversation_participants (conversation_id, profile_id, role) values (created, auth.uid(), 'admin');
  insert into public.conversation_participants (conversation_id, profile_id, role)
  select distinct created, m, 'member' from unnest(members) m where m <> auth.uid();
  perform public.post_group_event(created, jsonb_build_object('event', 'created', 'title', left(trim(group_title), 80)));
  return created;
end
$$;

create function public.add_group_members(target uuid, members uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid;
  added uuid[] := '{}';
begin
  if not public.is_group_admin(target) then
    raise exception 'only admins add members' using errcode = '42501';
  end if;
  foreach member in array members loop
    if not exists (select 1 from public.conversation_participants p where p.conversation_id = target and p.profile_id = member) then
      if not public.can_message(member) then
        raise exception 'not allowed to add %', member using errcode = '42501';
      end if;
      insert into public.conversation_participants (conversation_id, profile_id) values (target, member);
      added := added || member;
    end if;
  end loop;
  if array_length(added, 1) > 0 then
    perform public.post_group_event(target, jsonb_build_object('event', 'added', 'targets', to_jsonb(added)));
  end if;
end
$$;

create function public.remove_group_member(target uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_admin(target) or member = auth.uid() then
    raise exception 'only admins remove other members' using errcode = '42501';
  end if;
  delete from public.conversation_participants where conversation_id = target and profile_id = member;
  if found then
    perform public.post_group_event(target, jsonb_build_object('event', 'removed', 'targets', jsonb_build_array(member)));
  end if;
end
$$;

-- Leaving: the last admin hands over to the longest-standing member.
create function public.leave_group(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.conversations c where c.id = target and c.kind = 'group') or not public.is_participant(target) then
    raise exception 'not in this group' using errcode = '42501';
  end if;
  perform public.post_group_event(target, jsonb_build_object('event', 'left'));
  delete from public.conversation_participants where conversation_id = target and profile_id = auth.uid();
  if not exists (select 1 from public.conversation_participants where conversation_id = target and role = 'admin') then
    update public.conversation_participants set role = 'admin'
    where conversation_id = target and profile_id = (
      select profile_id from public.conversation_participants where conversation_id = target order by joined_at limit 1
    );
  end if;
end
$$;

create function public.set_group_admin(target uuid, member uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_admin(target) then
    raise exception 'only admins change admins' using errcode = '42501';
  end if;
  if not make_admin and (select count(*) from public.conversation_participants where conversation_id = target and role = 'admin') <= 1
     and exists (select 1 from public.conversation_participants where conversation_id = target and profile_id = member and role = 'admin') then
    raise exception 'a group keeps at least one admin' using errcode = '23514';
  end if;
  update public.conversation_participants set role = case when make_admin then 'admin' else 'member' end
  where conversation_id = target and profile_id = member;
  if found then
    perform public.post_group_event(target, jsonb_build_object('event', case when make_admin then 'admin' else 'notAdmin' end, 'targets', jsonb_build_array(member)));
  end if;
end
$$;

-- Name, description and photo (members unless admins-only); the two settings (admins only).
create function public.update_group(target uuid, patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current public.conversations;
begin
  select * into current from public.conversations where id = target and kind = 'group';
  if not found or not public.can_edit_group(target) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (patch ? 'only_admins_send' or patch ? 'only_admins_edit') and not public.is_group_admin(target) then
    raise exception 'only admins change the settings' using errcode = '42501';
  end if;
  if patch ? 'photo_path' and patch ->> 'photo_path' is not null and (patch ->> 'photo_path') not like target::text || '/%' then
    raise exception 'the photo must be stored with the group' using errcode = '22023';
  end if;

  update public.conversations set
    title = case when patch ? 'title' then left(trim(patch ->> 'title'), 80) else title end,
    description = case when patch ? 'description' then left(coalesce(patch ->> 'description', ''), 500) else description end,
    photo_path = case when patch ? 'photo_path' then patch ->> 'photo_path' else photo_path end,
    only_admins_send = coalesce((patch ->> 'only_admins_send')::boolean, only_admins_send),
    only_admins_edit = coalesce((patch ->> 'only_admins_edit')::boolean, only_admins_edit)
  where id = target;

  if patch ? 'title' and left(trim(patch ->> 'title'), 80) is distinct from current.title then
    perform public.post_group_event(target, jsonb_build_object('event', 'title', 'value', left(trim(patch ->> 'title'), 80)));
  end if;
  if patch ? 'description' and coalesce(patch ->> 'description', '') is distinct from current.description then
    perform public.post_group_event(target, jsonb_build_object('event', 'description'));
  end if;
  if patch ? 'photo_path' and (patch ->> 'photo_path') is distinct from current.photo_path then
    perform public.post_group_event(target, jsonb_build_object('event', 'photo'));
  end if;
  if (patch ? 'only_admins_send' and (patch ->> 'only_admins_send')::boolean is distinct from current.only_admins_send)
     or (patch ? 'only_admins_edit' and (patch ->> 'only_admins_edit')::boolean is distinct from current.only_admins_edit) then
    perform public.post_group_event(target, jsonb_build_object('event', 'settings',
      'only_admins_send', coalesce((patch ->> 'only_admins_send')::boolean, current.only_admins_send),
      'only_admins_edit', coalesce((patch ->> 'only_admins_edit')::boolean, current.only_admins_edit)));
  end if;
end
$$;

create function public.pin_message(target uuid, pin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation uuid;
begin
  select m.conversation_id into conversation from public.messages m where m.id = target and m.deleted_at is null;
  if conversation is null or not public.is_participant(conversation)
     or ((select kind from public.conversations where id = conversation) = 'group' and not public.can_edit_group(conversation)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.messages
  set pinned_at = case when pin then now() else null end, pinned_by = case when pin then auth.uid() else null end
  where id = target;
end
$$;

create function public.create_poll(target uuid, poll_question text, poll_options text[], allow_multiple boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  message uuid;
  poll uuid;
  i integer;
begin
  if not public.can_post(target) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(poll_options, 1), 0) not between 2 and 12 then
    raise exception 'a poll has 2 to 12 options' using errcode = '22023';
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body) values (target, auth.uid(), 'poll', left(trim(poll_question), 300))
  returning id into message;
  insert into public.polls (message_id, conversation_id, question, multiple, created_by)
  values (message, target, left(trim(poll_question), 300), allow_multiple, auth.uid())
  returning id into poll;
  for i in 1 .. array_length(poll_options, 1) loop
    if length(trim(poll_options[i])) > 0 then
      insert into public.poll_options (poll_id, label, position) values (poll, left(trim(poll_options[i]), 100), i);
    end if;
  end loop;
  return message;
end
$$;

-- A vote replaces one's earlier choice (one option, or several when the poll allows it).
create function public.vote_poll(target_poll uuid, choices uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  poll public.polls;
begin
  select * into poll from public.polls where id = target_poll;
  if not found or not public.is_participant(poll.conversation_id) or poll.closed_at is not null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not poll.multiple and coalesce(array_length(choices, 1), 0) > 1 then
    raise exception 'this poll takes one answer' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(choices) c where not exists (select 1 from public.poll_options o where o.id = c and o.poll_id = target_poll)) then
    raise exception 'unknown option' using errcode = '22023';
  end if;
  delete from public.poll_votes where poll_id = target_poll and profile_id = auth.uid();
  insert into public.poll_votes (poll_id, option_id, profile_id)
  select distinct target_poll, c, auth.uid() from unnest(choices) c;
end
$$;

create function public.close_poll(target_poll uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.polls set closed_at = now()
  where id = target_poll and closed_at is null
    and (created_by = auth.uid() or public.is_group_admin(conversation_id));
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end
$$;

-- A file from the resource library. One's own personal files are shared with everyone in the chat;
-- library and school files go only where everyone can already open them.
create function public.send_resource(target uuid, file uuid, note text default '', answer uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.library_files;
  folder public.library_folders;
  message uuid;
begin
  if not public.can_post(target) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into item from public.library_files where id = file and deleted_at is null;
  if not found then
    raise exception 'unknown file' using errcode = 'P0002';
  end if;
  select * into folder from public.library_folders where id = item.folder_id;
  if folder.space = 'personal' then
    if folder.owner_id <> auth.uid() then
      raise exception 'only your own personal files can be sent' using errcode = '42501';
    end if;
    insert into public.library_shares (file_id, profile_id, shared_by)
    select file, p.profile_id, auth.uid() from public.conversation_participants p
    where p.conversation_id = target and p.profile_id <> auth.uid()
    on conflict do nothing;
  elsif not public.can_read_folder(folder.id) then
    raise exception 'not allowed' using errcode = '42501';
  elsif folder.space = 'school' and exists (
    select 1 from public.conversation_participants p join public.profiles pr on pr.id = p.profile_id
    where p.conversation_id = target and pr.role not in ('staff', 'admin') and pr.school_id is distinct from folder.school_id
  ) then
    raise exception 'someone in this chat cannot open files of that school' using errcode = '42501';
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body, library_file_id, reply_to)
  values (target, auth.uid(), 'resource', left(coalesce(note, ''), 4000), file, answer)
  returning id into message;
  return message;
end
$$;

revoke all on function public.is_group_admin(uuid), public.can_edit_group(uuid), public.create_group(text, uuid[], text),
  public.add_group_members(uuid, uuid[]), public.remove_group_member(uuid, uuid), public.leave_group(uuid),
  public.set_group_admin(uuid, uuid, boolean), public.update_group(uuid, jsonb), public.pin_message(uuid, boolean),
  public.create_poll(uuid, text, text[], boolean), public.vote_poll(uuid, uuid[]), public.close_poll(uuid),
  public.send_resource(uuid, uuid, text, uuid), public.check_message_reply() from public, anon;
grant execute on function public.is_group_admin(uuid), public.can_edit_group(uuid), public.create_group(text, uuid[], text),
  public.add_group_members(uuid, uuid[]), public.remove_group_member(uuid, uuid), public.leave_group(uuid),
  public.set_group_admin(uuid, uuid, boolean), public.update_group(uuid, jsonb), public.pin_message(uuid, boolean),
  public.create_poll(uuid, text, text[], boolean), public.vote_poll(uuid, uuid[]), public.close_poll(uuid),
  public.send_resource(uuid, uuid, text, uuid) to authenticated;
revoke execute on function public.check_message_reply() from authenticated;

-- ===========================================================================
-- Access
-- ===========================================================================

-- People type text, stickers and GIFs themselves; polls, notes and library files go through the functions above.
alter policy "messages: participants send unless blocked"
  on public.messages
  with check (
    sender_id = (select auth.uid()) and public.can_post(conversation_id)
    and deleted_at is null and edited_at is null and pinned_at is null and system is null and library_file_id is null
    and kind in ('text', 'sticker', 'gif')
  );

alter table public.message_reactions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.message_reactions, public.polls, public.poll_options, public.poll_votes from anon;
revoke insert, update, delete on public.polls, public.poll_options, public.poll_votes from authenticated;
revoke update on public.message_reactions from authenticated;

create policy "reactions: participants see them"
  on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id)));

create policy "reactions: participants react as themselves"
  on public.message_reactions for insert to authenticated
  with check (profile_id = (select auth.uid()) and exists (
    select 1 from public.messages m where m.id = message_id and m.deleted_at is null and public.is_participant(m.conversation_id)
  ));

create policy "reactions: take back your own"
  on public.message_reactions for delete to authenticated
  using (profile_id = (select auth.uid()));

create policy "polls: participants see them"
  on public.polls for select to authenticated
  using (public.is_participant(conversation_id));

create policy "poll options: participants see them"
  on public.poll_options for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and public.is_participant(p.conversation_id)));

create policy "poll votes: participants see who voted what"
  on public.poll_votes for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and public.is_participant(p.conversation_id)));

-- Live updates for groups, reactions and polls
alter publication supabase_realtime add table public.conversations, public.conversation_participants, public.message_reactions, public.polls, public.poll_votes;
