-- re_form platform · removing demo content
-- supabase/demo.sql adds example content marked "[demo]" / is_demo; admins remove it in one go.
-- Demo schools are kept while real accounts still belong to them.

create function public.remove_demo_content()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed jsonb;
  n_activities integer;
  n_boards integer;
  n_folders integer;
  n_assessments integer;
  n_schools integer;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  delete from public.activities where is_demo;
  get diagnostics n_activities = row_count;
  delete from public.boards where is_demo;
  get diagnostics n_boards = row_count;
  delete from public.library_files where is_demo and storage_path is null;
  delete from public.library_folders f
  where f.is_demo and not exists (select 1 from public.library_files x where x.folder_id = f.id);
  get diagnostics n_folders = row_count;
  delete from public.assessments where is_demo;
  get diagnostics n_assessments = row_count;
  delete from public.schools s
  where s.name like '[demo]%'
    and not exists (select 1 from public.profiles p where p.school_id = s.id)
    and not exists (select 1 from public.boards b where b.school_id = s.id)
    and not exists (select 1 from public.library_folders f where f.school_id = s.id);
  get diagnostics n_schools = row_count;

  removed := jsonb_build_object('activities', n_activities, 'boards', n_boards, 'folders', n_folders,
                                'assessments', n_assessments, 'schools', n_schools);
  insert into public.audit_log (actor_id, action, target_type, details)
  values (auth.uid(), 'demo.removed', 'demo', removed);
  return removed;
end
$$;

revoke all on function public.remove_demo_content() from public, anon;
grant execute on function public.remove_demo_content() to authenticated, service_role;
