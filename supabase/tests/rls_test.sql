-- Access-rule tests for every module. Run against a local stack:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- Everything runs in one transaction and is rolled back.
begin;

-- Start from an empty database: set aside the demo content from supabase/demo.sql (rolled back at the end).
delete from public.activities where is_demo;
delete from public.boards where is_demo;
delete from public.library_folders where is_demo;
delete from public.assessments where is_demo;
delete from public.schools where name like '[demo]%' and not exists (select 1 from public.profiles p where p.school_id = schools.id);

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true)
$$;
create function pg_temp.as_admin_db() returns void language sql as $$ select set_config('role', 'postgres', true) $$;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if;
end $$;
create function pg_temp.fails(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'PASS  % (refused: %)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL  % (was allowed)', label;
end $$;

-- People: admin, staff, two students in school 1 (one core lead), one student in school 2
insert into public.schools (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'T1'), ('10000000-0000-0000-0000-000000000002', 'T2');
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@t', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'staff@t', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000003', 's1@t', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000004', 'lead1@t', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000005', 's2@t', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, role, school_id) values
  ('a0000000-0000-0000-0000-000000000001', 'Admin', 'admin', null),
  ('a0000000-0000-0000-0000-000000000002', 'Staff', 'staff', null),
  ('a0000000-0000-0000-0000-000000000003', 'S1', 'student', '10000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'Lead1', 'core_lead', '10000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'S2', 'student', '10000000-0000-0000-0000-000000000002');

-- ===== News panel =====
insert into public.activities (id, title, category, starts_at, status, publish_at) values
  ('b0000000-0000-0000-0000-000000000001', 'Published', 'workshop', now() + interval '3 days', 'published', now() - interval '1 hour'),
  ('b0000000-0000-0000-0000-000000000002', 'Draft one', 'event', now() + interval '3 days', 'draft', now()),
  ('b0000000-0000-0000-0000-000000000003', 'Scheduled', 'event', now() + interval '9 days', 'published', now() + interval '1 day');
set local role anon;
select pg_temp.check((select count(*) from public.activities where id::text like 'b0000000-%') = 1, 'visitor sees only the published, already-live activity');
select pg_temp.check((select count(*) from public.schools) >= 2, 'visitor can list partner schools');
select pg_temp.check(((public.public_stats())->>'activities')::int >= 1, 'visitor gets public stats');
select pg_temp.fails($$insert into public.newsletter_subscribers (email) values ('x@y.ro')$$, 'visitor cannot write the subscriber table directly');
select public.subscribe_newsletter('Nume@Exemplu.ro', 'ro');
select pg_temp.fails($$select public.subscribe_newsletter('not-an-email', 'ro')$$, 'newsletter rejects a bad email');
reset role;
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.activities where id::text like 'b0000000-%') = 1, 'student sees only published activities');
select pg_temp.fails($$insert into public.activities (title, category, starts_at) values ('Hack', 'event', now())$$, 'student cannot create activities');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.activities where id::text like 'b0000000-%') = 3, 'staff sees drafts and scheduled posts');
insert into public.activities (title, category, starts_at) values ('Staff draft', 'meeting', now());
select pg_temp.as_admin_db();

-- ===== Library =====
insert into public.library_folders (id, space, school_id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'shared', null, 'Shared'),
  ('c0000000-0000-0000-0000-000000000002', 'school', '10000000-0000-0000-0000-000000000001', 'School 1'),
  ('c0000000-0000-0000-0000-000000000003', 'school', '10000000-0000-0000-0000-000000000002', 'School 2');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.library_folders) = 2, 'student sees the shared library and own school folder only');
insert into public.library_files (folder_id, name, storage_path, uploaded_by)
values ('c0000000-0000-0000-0000-000000000002', 'plan.pdf', 'c0000000-0000-0000-0000-000000000002/x-plan.pdf', 'a0000000-0000-0000-0000-000000000003');
select pg_temp.fails($$insert into public.library_files (folder_id, name, storage_path, uploaded_by)
  values ('c0000000-0000-0000-0000-000000000001', 'x.pdf', 'c0000000-0000-0000-0000-000000000001/x.pdf', 'a0000000-0000-0000-0000-000000000003')$$,
  'student cannot upload into the shared library');
select pg_temp.fails($$insert into public.library_files (folder_id, name, storage_path, uploaded_by)
  values ('c0000000-0000-0000-0000-000000000003', 'x.pdf', 'c0000000-0000-0000-0000-000000000003/x.pdf', 'a0000000-0000-0000-0000-000000000003')$$,
  'student cannot upload into another school');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.library_files) = 0, 'student of school 2 cannot see school 1 files');
select pg_temp.as_admin_db();

-- ===== Workspace =====
insert into public.boards (id, school_id, name) values
  ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Board 1'),
  ('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Board 2');
insert into public.board_columns (id, board_id, name, position) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'To do', 1),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'To do', 1);
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.boards) = 1, 'student sees only own school board');
insert into public.cards (id, board_id, column_id, title) values
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Task');
select pg_temp.check((select count(*) from public.card_events where card_id = 'f0000000-0000-0000-0000-000000000001') = 1, 'card creation is logged');
select pg_temp.fails($$insert into public.cards (board_id, column_id, title) values
  ('d0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'Sneak')$$, 'student cannot add cards to another school board');
select pg_temp.fails($$insert into public.cards (board_id, column_id, title) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Wrong column')$$, 'card cannot point at a column of another board');
select pg_temp.fails($$insert into public.boards (school_id, name, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Mine', 'a0000000-0000-0000-0000-000000000003')$$, 'plain student cannot create boards');
select pg_temp.fails($$insert into public.card_events (card_id, kind) values ('f0000000-0000-0000-0000-000000000001', 'fake')$$, 'nobody writes card history by hand');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
insert into public.boards (school_id, name, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Lead board', 'a0000000-0000-0000-0000-000000000004');
select pg_temp.check(true, 'core lead creates a board for own school');
select pg_temp.as_admin_db();

-- ===== Assessments =====
insert into public.assessments (id, title, kind, opens_at, closes_at, status, show_answers) values
  ('aa000000-0000-0000-0000-000000000001', 'Quiz 1', 'quiz', now() - interval '1 day', now() + interval '2 days', 'published', 'after_close'),
  ('aa000000-0000-0000-0000-000000000002', 'Future', 'quiz', now() + interval '5 days', now() + interval '9 days', 'published', 'after_submit');
insert into public.assessment_schools values
  ('aa000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');
insert into public.questions (id, assessment_id, position, kind, prompt, points) values
  ('ab000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 1, 'single', 'Q1', 1),
  ('ab000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000001', 2, 'multiple', 'Q2', 2),
  ('ab000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000002', 1, 'single', 'Future Q', 1);
insert into public.question_choices (id, question_id, label, position) values
  ('ac000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 'right', 1),
  ('ac000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000001', 'wrong', 2),
  ('ac000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000002', 'a', 1),
  ('ac000000-0000-0000-0000-000000000004', 'ab000000-0000-0000-0000-000000000002', 'b', 2),
  ('ac000000-0000-0000-0000-000000000005', 'ab000000-0000-0000-0000-000000000002', 'c', 3);
insert into public.choice_keys values
  ('ac000000-0000-0000-0000-000000000001', true), ('ac000000-0000-0000-0000-000000000002', false),
  ('ac000000-0000-0000-0000-000000000003', true), ('ac000000-0000-0000-0000-000000000004', true),
  ('ac000000-0000-0000-0000-000000000005', false);
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.assessments) = 0, 'student of another school does not see the quiz');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.assessments) = 2, 'targeted student sees both assessments');
select pg_temp.check((select count(*) from public.questions) = 2, 'questions of a not-yet-open quiz stay hidden');
select pg_temp.check((select count(*) from public.choice_keys) = 0, 'student cannot read the answer key');
create temp table t_attempt as select public.start_attempt('aa000000-0000-0000-0000-000000000001') as id;
select public.save_answer((select id from t_attempt), 'ab000000-0000-0000-0000-000000000001', array['ac000000-0000-0000-0000-000000000001']::uuid[], '');
select public.save_answer((select id from t_attempt), 'ab000000-0000-0000-0000-000000000002', array['ac000000-0000-0000-0000-000000000003']::uuid[], '');
update public.attempts set final_score = 100;
update public.answers set points_awarded = 5;
select pg_temp.as_admin_db();
select pg_temp.check((select final_score is null from public.attempts where id = (select id from t_attempt)), 'student cannot set their own score (update matches no rows)');
select pg_temp.check((select bool_and(points_awarded is null) from public.answers where attempt_id = (select id from t_attempt)), 'student cannot award points (update matches no rows)');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select public.submit_attempt((select id from t_attempt));
select pg_temp.check((select final_score from public.attempts where id = (select id from t_attempt)) = 1, 'auto score: 1 of 3 (multiple choice needs the exact set)');
select pg_temp.check((select bool_and(is_correct is null) from public.attempt_review((select id from t_attempt))), 'correctness stays hidden until the quiz closes');
select pg_temp.fails($$select public.start_attempt('aa000000-0000-0000-0000-000000000001')$$, 'no attempts left after the only attempt');
select pg_temp.fails($$select public.start_attempt('aa000000-0000-0000-0000-000000000002')$$, 'cannot start a quiz before it opens');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.attempt_review((select id from t_attempt)) where is_correct is not null) = 2, 'staff sees correctness');
select public.review_attempt((select id from t_attempt), '{}'::jsonb, 2, 'Bine!');
select pg_temp.check((select feedback from public.attempts where id = (select id from t_attempt)) = 'Bine!', 'staff feedback saved');
select pg_temp.as_admin_db();

-- ===== Messages =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.fails($$select public.start_conversation('a0000000-0000-0000-0000-000000000005')$$, 'student cannot message a student of another school');
create temp table t_conv as select public.start_conversation('a0000000-0000-0000-0000-000000000004') as id;
select pg_temp.check((select public.start_conversation('a0000000-0000-0000-0000-000000000004')) = (select id from t_conv), 'second start returns the same conversation');
select public.start_conversation('a0000000-0000-0000-0000-000000000002');
-- (inside one test transaction now() never moves, so start the recipient's read marker in the past)
select pg_temp.as_admin_db();
update public.conversation_participants set last_read_at = now() - interval '1 minute' where conversation_id = (select id from t_conv);
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
insert into public.messages (conversation_id, body) values ((select id from t_conv), 'Salut!');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
select pg_temp.check((select unread from public.unread_counts() where conversation_id = (select id from t_conv)) = 1, 'recipient has one unread message');
insert into public.user_blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.fails(format($$insert into public.messages (conversation_id, body) values (%L, 'still there?')$$, (select id from t_conv)), 'blocked sender cannot post');
insert into public.message_reports (conversation_id, reason) values ((select id from t_conv), 'test report');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.messages where conversation_id = (select id from t_conv)) = 0, 'staff cannot read a conversation they are not in');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.admin_read_reported_conversation((select id from public.message_reports limit 1))) = 1, 'admin reads a reported conversation');
select pg_temp.check((select count(*) from public.audit_log where action = 'conversation.read_after_report') = 1, 'that access is logged');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.messages) = 0, 'outsider sees no messages');


-- ===== Assessment editor and function privileges =====
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select pg_temp.fails($$select public.save_assessment('{"title":"Hack","kind":"quiz","opens_at":"2026-01-01T00:00:00Z","closes_at":"2027-01-01T00:00:00Z"}'::jsonb)$$, 'student cannot create assessments');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
create temp table t_editor as select public.save_assessment(jsonb_build_object(
  'title', 'Editor quiz', 'kind', 'quiz', 'opens_at', now() - interval '1 day', 'closes_at', now() + interval '1 day',
  'status', 'published', 'school_ids', jsonb_build_array('10000000-0000-0000-0000-000000000001'),
  'questions', jsonb_build_array(
    jsonb_build_object('kind', 'single', 'prompt', 'Q1', 'points', 2, 'choices', jsonb_build_array(
      jsonb_build_object('label', 'yes', 'correct', true), jsonb_build_object('label', 'no', 'correct', false))),
    jsonb_build_object('kind', 'open', 'prompt', 'Q2', 'points', 3))
)) as id;
select pg_temp.check((select count(*) from public.questions where assessment_id = (select id from t_editor)) = 2, 'editor saves the questions');
select pg_temp.check((select count(*) from public.choice_keys k join public.question_choices c on c.id = k.choice_id join public.questions q on q.id = c.question_id where q.assessment_id = (select id from t_editor) and k.is_correct) = 1, 'editor saves the answer key');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select public.start_attempt((select id from t_editor));
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select public.save_assessment(jsonb_build_object(
  'id', (select id from t_editor), 'title', 'Editor quiz, renamed', 'kind', 'assignment', 'opens_at', now() - interval '1 day',
  'closes_at', now() + interval '2 days', 'status', 'published', 'school_ids', jsonb_build_array('10000000-0000-0000-0000-000000000001'),
  'questions', '[]'::jsonb));
select pg_temp.check((select count(*) from public.questions where assessment_id = (select id from t_editor)) = 2, 'questions are locked once a student started');
select pg_temp.check((select kind = 'quiz' and title = 'Editor quiz, renamed' from public.assessments where id = (select id from t_editor)), 'kind is locked, title still editable');
select pg_temp.as_admin_db();
set local role anon;
select pg_temp.fails($$select public.start_attempt('aa000000-0000-0000-0000-000000000001')$$, 'visitors cannot call account functions');
reset role;

rollback;
