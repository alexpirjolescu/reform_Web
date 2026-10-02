-- re_form platform · function privileges
-- Postgres lets PUBLIC (and Supabase's anon role) execute new functions by default. Visitors only
-- need the few functions the public news panel uses; everything else is for signed-in accounts.

do $$
declare
  fn record;
  public_ok constant text[] := array['is_staff', 'activity_is_public', 'public_stats', 'subscribe_newsletter'];
begin
  for fn in
    select p.oid::regprocedure as signature, p.proname as name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    if fn.name = any (public_ok) then
      execute format('grant execute on function %s to anon, authenticated', fn.signature);
    else
      execute format('revoke execute on function %s from public, anon', fn.signature);
      execute format('grant execute on function %s to authenticated, service_role', fn.signature);
    end if;
  end loop;
end
$$;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
