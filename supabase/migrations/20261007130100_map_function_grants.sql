-- re_form platform · privileges for the board functions added in 20261007130000
-- Trigger functions and the map seeding run inside the database only; nobody calls them through the API.
-- (Triggers still fire: Postgres checks EXECUTE when a trigger is created, not when it runs.)

revoke execute on function public.seed_board_map(uuid) from public, anon, authenticated;
revoke execute on function public.seed_board_map_on_create() from public, anon, authenticated;
revoke execute on function public.sync_card_map_node() from public, anon, authenticated;
revoke execute on function public.stamp_checklist_done() from public, anon, authenticated;
revoke execute on function public.check_comment_parent() from public, anon, authenticated;
revoke execute on function public.check_map_node() from public, anon, authenticated;
revoke execute on function public.check_map_link() from public, anon, authenticated;

-- Used by row-level security for signed-in accounts only.
revoke execute on function public.can_access_checklist_item(uuid) from public, anon;
grant execute on function public.can_access_checklist_item(uuid) to authenticated;
