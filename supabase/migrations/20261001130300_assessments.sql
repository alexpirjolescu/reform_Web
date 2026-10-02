-- re_form platform · assessments (PRD module 4): quizzes and file assignments after meetings
-- Correct answers live in a staff-only table; students only ever see them through
-- attempt_review(), and only when the assessment's show_answers rule allows it.

create type public.assessment_kind as enum ('quiz', 'assignment');
create type public.question_kind as enum ('single', 'multiple', 'true_false', 'open');

create table public.assessments (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) between 3 and 160),
  kind         public.assessment_kind not null,
  instructions text not null default '',
  activity_id  uuid references public.activities (id) on delete set null,
  opens_at     timestamptz not null default now(),
  closes_at    timestamptz not null,
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  show_answers text not null default 'after_close' check (show_answers in ('after_submit', 'after_close', 'never')),
  allow_late   boolean not null default true,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  is_demo      boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint assessments_window check (closes_at > opens_at)
);

comment on column public.assessments.activity_id is 'The in-person meeting (news panel activity) this assessment follows (AS-3).';

create table public.assessment_schools (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  school_id     uuid not null references public.schools (id) on delete cascade,
  primary key (assessment_id, school_id)
);

create index assessment_schools_school_idx on public.assessment_schools (school_id);

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  position      integer not null default 0,
  kind          public.question_kind not null,
  prompt        text not null check (length(trim(prompt)) between 1 and 2000),
  points        numeric(6, 2) not null default 1 check (points >= 0)
);

create index questions_assessment_idx on public.questions (assessment_id, position);

create table public.question_choices (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label       text not null check (length(trim(label)) between 1 and 500),
  position    integer not null default 0
);

create index question_choices_question_idx on public.question_choices (question_id, position);

create table public.choice_keys (
  choice_id  uuid primary key references public.question_choices (id) on delete cascade,
  is_correct boolean not null default false
);

comment on table public.choice_keys is 'Answer key. Staff only; never exposed to students directly.';

create table public.attempts (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  attempt_number integer not null default 1,
  status         text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'reviewed')),
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  is_late        boolean not null default false,
  auto_score     numeric(8, 2),
  final_score    numeric(8, 2),
  max_score      numeric(8, 2),
  text_response  text not null default '',
  link_response  text not null default '',
  feedback       text not null default '',
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  unique (assessment_id, student_id, attempt_number)
);

create index attempts_student_idx on public.attempts (student_id);

create table public.answers (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.attempts (id) on delete cascade,
  question_id    uuid not null references public.questions (id) on delete cascade,
  choice_ids     uuid[] not null default '{}',
  text_answer    text not null default '' check (length(text_answer) <= 8000),
  is_correct     boolean,
  points_awarded numeric(6, 2),
  unique (attempt_id, question_id)
);

create table public.submission_files (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.attempts (id) on delete cascade,
  name         text not null,
  storage_path text not null unique,
  mime_type    text not null default 'application/octet-stream',
  size_bytes   bigint not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.can_see_assessment(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1
    from public.assessments a
    join public.assessment_schools s on s.assessment_id = a.id
    where a.id = target
      and a.status = 'published'
      and s.school_id = public.current_school_id()
      and public.current_app_role() in ('student', 'core_lead')
  )
$$;

create function public.can_see_questions(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff() or (
    public.can_see_assessment(target)
    and exists (select 1 from public.assessments a where a.id = target and a.opens_at <= now())
  )
$$;

create function public.owns_attempt(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.attempts t where t.id = target and t.student_id = auth.uid())
$$;

revoke all on function public.can_see_assessment(uuid) from public;
revoke all on function public.can_see_questions(uuid)  from public;
revoke all on function public.owns_attempt(uuid)       from public;
grant execute on function public.can_see_assessment(uuid) to authenticated;
grant execute on function public.can_see_questions(uuid)  to authenticated;
grant execute on function public.owns_attempt(uuid)       to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.assessments        enable row level security;
alter table public.assessment_schools enable row level security;
alter table public.questions          enable row level security;
alter table public.question_choices   enable row level security;
alter table public.choice_keys        enable row level security;
alter table public.attempts           enable row level security;
alter table public.answers            enable row level security;
alter table public.submission_files   enable row level security;

revoke all on public.assessments, public.assessment_schools, public.questions, public.question_choices,
  public.choice_keys, public.attempts, public.answers, public.submission_files from anon;

-- Students write attempts and answers only through the functions below.
revoke insert, update, delete on public.attempts from authenticated;
revoke insert, update, delete on public.answers  from authenticated;
grant update (final_score, feedback, status, reviewed_by, reviewed_at) on public.attempts to authenticated;
grant update (points_awarded, is_correct) on public.answers to authenticated;

create policy "assessments: targeted students and staff read"
  on public.assessments for select to authenticated
  using (public.can_see_assessment(id));

create policy "assessments: staff write"
  on public.assessments for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "assessment schools: visible with the assessment"
  on public.assessment_schools for select to authenticated
  using (public.can_see_assessment(assessment_id));

create policy "assessment schools: staff write"
  on public.assessment_schools for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "questions: visible once the assessment opens"
  on public.questions for select to authenticated
  using (public.can_see_questions(assessment_id));

create policy "questions: staff write"
  on public.questions for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "choices: visible with their question"
  on public.question_choices for select to authenticated
  using (public.can_see_questions((select q.assessment_id from public.questions q where q.id = question_id)));

create policy "choices: staff write"
  on public.question_choices for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "answer key: staff only"
  on public.choice_keys for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "attempts: students read their own, staff read all"
  on public.attempts for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));

create policy "attempts: staff review"
  on public.attempts for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "answers: students read their own, staff read all"
  on public.answers for select to authenticated
  using (public.owns_attempt(attempt_id) or (select public.is_staff()));

create policy "answers: staff review"
  on public.answers for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "submission files: owner and staff read"
  on public.submission_files for select to authenticated
  using (public.owns_attempt(attempt_id) or (select public.is_staff()));

create policy "submission files: owner adds while the attempt is open"
  on public.submission_files for insert to authenticated
  with check (
    public.owns_attempt(attempt_id)
    and exists (select 1 from public.attempts t where t.id = attempt_id and t.status = 'in_progress')
  );

create policy "submission files: owner removes while the attempt is open"
  on public.submission_files for delete to authenticated
  using (
    public.owns_attempt(attempt_id)
    and exists (select 1 from public.attempts t where t.id = attempt_id and t.status = 'in_progress')
  );

-- ---------------------------------------------------------------------------
-- Student functions: start, save, submit, review
-- ---------------------------------------------------------------------------

create function public.start_attempt(target uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.assessments;
  open_attempt uuid;
  used integer;
  new_id uuid;
begin
  if not public.can_see_assessment(target) or public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into a from public.assessments where id = target;
  if a.opens_at > now() then raise exception 'not open yet' using errcode = 'P0001'; end if;
  if a.closes_at < now() and not a.allow_late then raise exception 'closed' using errcode = 'P0001'; end if;

  select id into open_attempt from public.attempts
  where assessment_id = target and student_id = auth.uid() and status = 'in_progress';
  if open_attempt is not null then return open_attempt; end if;

  select count(*) into used from public.attempts where assessment_id = target and student_id = auth.uid();
  if used >= a.max_attempts then raise exception 'no attempts left' using errcode = 'P0001'; end if;

  insert into public.attempts (assessment_id, student_id, attempt_number)
  values (target, auth.uid(), used + 1)
  returning id into new_id;
  return new_id;
end
$$;

create function public.save_answer(target_attempt uuid, target_question uuid, selected uuid[], answer_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.attempts t
    join public.questions q on q.assessment_id = t.assessment_id
    where t.id = target_attempt and q.id = target_question
      and t.student_id = auth.uid() and t.status = 'in_progress'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Only choices that belong to the question are kept.
  insert into public.answers (attempt_id, question_id, choice_ids, text_answer)
  values (
    target_attempt, target_question,
    coalesce((select array_agg(c.id) from public.question_choices c
              where c.question_id = target_question and c.id = any (coalesce(selected, '{}'))), '{}'),
    left(coalesce(answer_text, ''), 8000)
  )
  on conflict (attempt_id, question_id)
  do update set choice_ids = excluded.choice_ids, text_answer = excluded.text_answer;
end
$$;

create function public.save_attempt_response(target_attempt uuid, response_text text, response_link text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attempts
  set text_response = left(coalesce(response_text, ''), 8000),
      link_response = left(coalesce(response_link, ''), 500)
  where id = target_attempt and student_id = auth.uid() and status = 'in_progress';
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
end
$$;

create function public.submit_attempt(target_attempt uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.attempts;
  a public.assessments;
  needs_review boolean;
  auto numeric;
  total numeric;
begin
  select * into t from public.attempts where id = target_attempt and student_id = auth.uid() for update;
  if t.id is null or t.status <> 'in_progress' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into a from public.assessments where id = t.assessment_id;
  if a.closes_at < now() and not a.allow_late then raise exception 'closed' using errcode = 'P0001'; end if;

  -- Make sure every question has an answer row, so scoring and review see all of them.
  insert into public.answers (attempt_id, question_id)
  select t.id, q.id from public.questions q where q.assessment_id = t.assessment_id
  on conflict (attempt_id, question_id) do nothing;

  -- Score choice questions: correct when the chosen set equals the set of correct choices.
  update public.answers ans
  set is_correct = (
        select coalesce(array_agg(c.id order by c.id), '{}') from public.question_choices c
        join public.choice_keys k on k.choice_id = c.id and k.is_correct
        where c.question_id = ans.question_id
      ) = (select coalesce(array_agg(x order by x), '{}') from unnest(ans.choice_ids) x),
      points_awarded = null
  from public.questions q
  where ans.attempt_id = t.id and q.id = ans.question_id and q.kind <> 'open';

  update public.answers ans
  set points_awarded = case when ans.is_correct then q.points else 0 end
  from public.questions q
  where ans.attempt_id = t.id and q.id = ans.question_id and q.kind <> 'open';

  select coalesce(sum(ans.points_awarded), 0) into auto
  from public.answers ans where ans.attempt_id = t.id;
  select coalesce(sum(q.points), 0) into total
  from public.questions q where q.assessment_id = t.assessment_id;

  needs_review := a.kind = 'assignment'
    or exists (select 1 from public.questions q where q.assessment_id = t.assessment_id and q.kind = 'open');

  update public.attempts
  set status = case when needs_review then 'submitted' else 'reviewed' end,
      submitted_at = now(),
      is_late = now() > a.closes_at,
      auto_score = auto,
      max_score = case when a.kind = 'assignment' and total = 0 then 10 else total end,
      final_score = case when needs_review then null else auto end,
      reviewed_at = case when needs_review then null else now() end
  where id = t.id;
end
$$;

-- What a student may see after submitting: correctness only when the assessment allows it.
create function public.attempt_review(target_attempt uuid)
returns table (question_id uuid, is_correct boolean, points_awarded numeric, correct_choice_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t public.attempts;
  a public.assessments;
  reveal boolean;
begin
  select * into t from public.attempts where id = target_attempt;
  if t.id is null or (t.student_id <> auth.uid() and not public.is_staff()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into a from public.assessments where id = t.assessment_id;
  reveal := public.is_staff() or (t.status <> 'in_progress' and (
    a.show_answers = 'after_submit' or (a.show_answers = 'after_close' and a.closes_at <= now())
  ));

  return query
  select ans.question_id,
         case when reveal then ans.is_correct end,
         case when reveal and t.status = 'reviewed' then ans.points_awarded end,
         case when reveal then (
           select coalesce(array_agg(c.id), '{}') from public.question_choices c
           join public.choice_keys k on k.choice_id = c.id and k.is_correct
           where c.question_id = ans.question_id
         ) end
  from public.answers ans
  where ans.attempt_id = t.id;
end
$$;

-- Staff: grade open answers and hand-ins, add feedback (AS-6).
create function public.review_attempt(target_attempt uuid, open_points jsonb, score numeric, feedback_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.attempts;
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into t from public.attempts where id = target_attempt for update;
  if t.id is null or t.status = 'in_progress' then raise exception 'not submitted' using errcode = 'P0001'; end if;

  update public.answers ans
  set points_awarded = least(greatest((open_points ->> ans.question_id::text)::numeric, 0), q.points)
  from public.questions q
  where ans.attempt_id = t.id and q.id = ans.question_id and q.kind = 'open'
    and open_points ? ans.question_id::text;

  update public.attempts
  set final_score = coalesce(score, (select coalesce(sum(points_awarded), 0) from public.answers where attempt_id = t.id)),
      feedback = left(coalesce(feedback_text, ''), 8000),
      status = 'reviewed',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = t.id;
end
$$;

revoke all on function public.start_attempt(uuid) from public;
revoke all on function public.save_answer(uuid, uuid, uuid[], text) from public;
revoke all on function public.save_attempt_response(uuid, text, text) from public;
revoke all on function public.submit_attempt(uuid) from public;
revoke all on function public.attempt_review(uuid) from public;
revoke all on function public.review_attempt(uuid, jsonb, numeric, text) from public;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.save_answer(uuid, uuid, uuid[], text) to authenticated;
grant execute on function public.save_attempt_response(uuid, text, text) to authenticated;
grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.attempt_review(uuid) to authenticated;
grant execute on function public.review_attempt(uuid, jsonb, numeric, text) to authenticated;

-- Storage: private "submissions" bucket; path = <attempt id>/<random>-<file name>
insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', false, 52428800)
on conflict (id) do nothing;

create policy "submission objects: owner uploads while open"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and exists (
      select 1 from public.attempts t
      where t.id = public.try_uuid((storage.foldername(name))[1])
        and t.student_id = (select auth.uid()) and t.status = 'in_progress'
    )
  );

create policy "submission objects: owner and staff read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and ((select public.is_staff()) or public.owns_attempt(public.try_uuid((storage.foldername(name))[1])))
  );

create policy "submission objects: owner removes while open"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1 from public.attempts t
      where t.id = public.try_uuid((storage.foldername(name))[1])
        and t.student_id = (select auth.uid()) and t.status = 'in_progress'
    )
  );
