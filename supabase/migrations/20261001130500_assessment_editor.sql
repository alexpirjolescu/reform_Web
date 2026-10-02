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
