-- re_form platform · messages: mark a conversation as read with the database clock
-- (the browser's clock may be behind, which would leave messages counted as unread).

create function public.mark_conversation_read(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = target and profile_id = auth.uid()
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;
