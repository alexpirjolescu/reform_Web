-- re_form platform · SQL for the hosted project "reform-web" that the Supabase connector could not apply
-- (it asks for a confirmation on any SQL that mentions DELETE or DROP).
-- Paste this whole file into Supabase → SQL Editor → New query and press Run, once.
-- Same as supabase/migrations/20261007120000_activity_media.sql (the save function) and
-- 20261007120100_drop_activity_photos.sql. The rest of 20261007120000 is already applied.

begin;

-- Saves an activity with its schools and media in one transaction (staff only).
create or replace function public.save_activity(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := nullif(payload ->> 'id', '')::uuid;
  item jsonb;
  item_position integer := 0;
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

  delete from public.activity_media where activity_id = target;
  for item in select value from jsonb_array_elements(coalesce(payload -> 'media', '[]'::jsonb)) loop
    item_position := item_position + 1;
    insert into public.activity_media (activity_id, kind, path, url, provider, title, caption, mime_type, size_bytes, position)
    values (
      target,
      item ->> 'kind',
      nullif(item ->> 'path', ''),
      nullif(item ->> 'url', ''),
      nullif(item ->> 'provider', ''),
      left(coalesce(item ->> 'title', ''), 300),
      left(coalesce(item ->> 'caption', ''), 300),
      nullif(item ->> 'mime_type', ''),
      nullif(item ->> 'size_bytes', '')::bigint,
      item_position
    );
  end loop;

  return target;
end
$$;

revoke all on function public.save_activity(jsonb) from public, anon;
grant execute on function public.save_activity(jsonb) to authenticated, service_role;

-- activity_photos is replaced by activity_media (it is empty on reform-web).
drop table if exists public.activity_photos;

commit;
