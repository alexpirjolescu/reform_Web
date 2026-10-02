-- re_form platform · the last three migrations for the hosted project "reform-web".
-- Paste this whole file into Supabase → SQL Editor → New query, then press Run (once).
-- They only create functions (assessment editor, news editor, demo cleanup); nothing is deleted when you run it.
-- The Supabase connector asks for a confirmation for any SQL that mentions DELETE, which is why these are applied by hand.

begin;

-- ===== supabase/migrations/20261001130500_assessment_editor.sql =====
-- re_form platform · assessment editor
-- Saves an assessment, its schools and its questions in one transaction. Once a student has
-- started an attempt, the questions and the kind are locked so answers keep pointing at the
-- questions they were given (the rest — dates, instructions, schools — stays editable).

create function public.save_assessment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := nullif(payload ->> 'id', '')::uuid;
  locked boolean := false;
  q jsonb;
  c jsonb;
  q_position integer := 0;
  c_position integer;
  new_question uuid;
  new_choice uuid;
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if target is null then
    insert into public.assessments (title, kind, instructions, activity_id, opens_at, closes_at, max_attempts, show_answers, allow_late, status, created_by)
    values (
      payload ->> 'title',
      (payload ->> 'kind')::public.assessment_kind,
      coalesce(payload ->> 'instructions', ''),
      nullif(payload ->> 'activity_id', '')::uuid,
      (payload ->> 'opens_at')::timestamptz,
      (payload ->> 'closes_at')::timestamptz,
      coalesce((payload ->> 'max_attempts')::integer, 1),
      coalesce(payload ->> 'show_answers', 'after_close'),
      coalesce((payload ->> 'allow_late')::boolean, true),
      coalesce(payload ->> 'status', 'draft'),
      auth.uid()
    )
    returning id into target;
  else
    select exists (select 1 from public.attempts where assessment_id = target) into locked;
    update public.assessments
    set title        = payload ->> 'title',
        kind         = case when locked then kind else (payload ->> 'kind')::public.assessment_kind end,
        instructions = coalesce(payload ->> 'instructions', ''),
        activity_id  = nullif(payload ->> 'activity_id', '')::uuid,
        opens_at     = (payload ->> 'opens_at')::timestamptz,
        closes_at    = (payload ->> 'closes_at')::timestamptz,
        max_attempts = coalesce((payload ->> 'max_attempts')::integer, 1),
        show_answers = coalesce(payload ->> 'show_answers', 'after_close'),
        allow_late   = coalesce((payload ->> 'allow_late')::boolean, true),
        status       = coalesce(payload ->> 'status', 'draft')
    where id = target;
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.assessment_schools where assessment_id = target;
  insert into public.assessment_schools (assessment_id, school_id)
  select distinct target, value::uuid
  from jsonb_array_elements_text(coalesce(payload -> 'school_ids', '[]'::jsonb));

  if not locked then
    delete from public.questions where assessment_id = target;
    for q in select value from jsonb_array_elements(coalesce(payload -> 'questions', '[]'::jsonb)) loop
      q_position := q_position + 1;
      insert into public.questions (assessment_id, position, kind, prompt, points)
      values (target, q_position, (q ->> 'kind')::public.question_kind, q ->> 'prompt', coalesce((q ->> 'points')::numeric, 1))
      returning id into new_question;

      c_position := 0;
      for c in select value from jsonb_array_elements(coalesce(q -> 'choices', '[]'::jsonb)) loop
        c_position := c_position + 1;
        insert into public.question_choices (question_id, label, position)
        values (new_question, c ->> 'label', c_position)
        returning id into new_choice;
        insert into public.choice_keys (choice_id, is_correct)
        values (new_choice, coalesce((c ->> 'correct')::boolean, false));
      end loop;
    end loop;
  end if;

  return target;
end
$$;

revoke all on function public.save_assessment(jsonb) from public, anon;
grant execute on function public.save_assessment(jsonb) to authenticated, service_role;

-- ===== supabase/migrations/20261001130800_activity_editor.sql =====
-- re_form platform · news panel editor
-- Saves an activity with its schools and photo gallery in one transaction (staff only).

create function public.save_activity(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := nullif(payload ->> 'id', '')::uuid;
  photo jsonb;
  photo_position integer := 0;
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if target is null then
    insert into public.activities (title, summary, body, category, starts_at, ends_at, location, cover_path, status, publish_at, photo_consent_confirmed, created_by)
    values (
      payload ->> 'title',
      coalesce(payload ->> 'summary', ''),
      coalesce(payload ->> 'body', ''),
      (payload ->> 'category')::public.activity_category,
      (payload ->> 'starts_at')::timestamptz,
      nullif(payload ->> 'ends_at', '')::timestamptz,
      coalesce(payload ->> 'location', ''),
      nullif(payload ->> 'cover_path', ''),
      coalesce(payload ->> 'status', 'draft'),
      coalesce(nullif(payload ->> 'publish_at', '')::timestamptz, now()),
      coalesce((payload ->> 'photo_consent_confirmed')::boolean, false),
      auth.uid()
    )
    returning id into target;
  else
    update public.activities
    set title = payload ->> 'title',
        summary = coalesce(payload ->> 'summary', ''),
        body = coalesce(payload ->> 'body', ''),
        category = (payload ->> 'category')::public.activity_category,
        starts_at = (payload ->> 'starts_at')::timestamptz,
        ends_at = nullif(payload ->> 'ends_at', '')::timestamptz,
        location = coalesce(payload ->> 'location', ''),
        cover_path = nullif(payload ->> 'cover_path', ''),
        status = coalesce(payload ->> 'status', 'draft'),
        publish_at = coalesce(nullif(payload ->> 'publish_at', '')::timestamptz, publish_at),
        photo_consent_confirmed = coalesce((payload ->> 'photo_consent_confirmed')::boolean, false)
    where id = target;
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.activity_schools where activity_id = target;
  insert into public.activity_schools (activity_id, school_id)
  select distinct target, value::uuid from jsonb_array_elements_text(coalesce(payload -> 'school_ids', '[]'::jsonb));

  delete from public.activity_photos where activity_id = target;
  for photo in select value from jsonb_array_elements(coalesce(payload -> 'photos', '[]'::jsonb)) loop
    photo_position := photo_position + 1;
    insert into public.activity_photos (activity_id, path, caption, position)
    values (target, photo ->> 'path', left(coalesce(photo ->> 'caption', ''), 300), photo_position);
  end loop;

  return target;
end
$$;

revoke all on function public.save_activity(jsonb) from public, anon;
grant execute on function public.save_activity(jsonb) to authenticated, service_role;

-- ===== supabase/migrations/20261001130900_demo_cleanup.sql =====
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

-- Record them like the other migrations (so the migration history matches).
insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261002070000', 'assessment_editor', '{}'),
  ('20261002070100', 'activity_editor', '{}'),
  ('20261002070200', 'demo_cleanup', '{}')
on conflict do nothing;

commit;
