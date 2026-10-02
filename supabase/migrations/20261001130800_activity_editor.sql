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
