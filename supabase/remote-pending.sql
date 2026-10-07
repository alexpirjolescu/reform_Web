-- To paste once into Supabase → SQL Editor for the project "reform-web", then press Run.
-- The Supabase connector asks for a confirmation before running anything with DELETE in it, so these
-- three functions from migration 20261008110000_messages_groups.sql are applied by hand.
-- Until then, in group chats: removing a member, leaving a group and voting in polls show an error.
-- Safe to run more than once.

create or replace function public.remove_group_member(target uuid, member uuid)
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

create or replace function public.leave_group(target uuid)
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

create or replace function public.vote_poll(target_poll uuid, choices uuid[])
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

revoke all on function public.remove_group_member(uuid, uuid), public.leave_group(uuid), public.vote_poll(uuid, uuid[]) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid), public.leave_group(uuid), public.vote_poll(uuid, uuid[]) to authenticated;
