-- re_form platform · indexes for foreign keys that queries and cascades follow
-- (from the Supabase performance advisor), and trigger functions closed to the API.

create index if not exists answers_question_idx on public.answers (question_id);
create index if not exists assessments_activity_idx on public.assessments (activity_id);
create index if not exists card_attachments_file_idx on public.card_attachments (file_id);
create index if not exists card_comments_author_idx on public.card_comments (author_id);
create index if not exists library_files_uploaded_by_idx on public.library_files (uploaded_by);
create index if not exists message_reports_conversation_idx on public.message_reports (conversation_id);
create index if not exists message_reports_message_idx on public.message_reports (message_id);
create index if not exists message_reports_reporter_idx on public.message_reports (reporter_id);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists submission_files_attempt_idx on public.submission_files (attempt_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);
create index if not exists activities_status_publish_idx on public.activities (status, publish_at);

-- Trigger functions run as triggers only; nobody needs to call them through the API.
revoke execute on function public.log_card_event() from authenticated;
revoke execute on function public.touch_conversation() from authenticated;
revoke execute on function public.check_card_column() from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
