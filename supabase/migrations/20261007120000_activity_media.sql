-- re_form platform · news posts with any kind of media
-- A news post (activity) can carry photos, videos, audio, documents, links, and posts embedded
-- from Instagram, Facebook, YouTube, Vimeo, TikTok, Spotify or Google Drive.
-- Replaces activity_photos (photos only), which 20261007120100 removes once the new code is live.

create table public.activity_media (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  kind        text not null check (kind in ('image', 'video', 'audio', 'file', 'embed', 'link')),
  -- Uploaded kinds: object path in the public "media" bucket.
  path        text check (path is null or (path like 'activities/%' and path not like '%..%')),
  -- Embeds and links: the original address people can also open.
  url         text check (url is null or (url ~ '^https://' and length(url) <= 2000)),
  provider    text check (provider is null or provider in ('instagram', 'facebook', 'youtube', 'vimeo', 'tiktok', 'spotify', 'drive')),
  title       text not null default '' check (length(title) <= 300),
  caption     text not null default '' check (length(caption) <= 300),
  mime_type   text,
  size_bytes  bigint check (size_bytes is null or size_bytes >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint activity_media_has_source check (
    (kind in ('image', 'video', 'audio', 'file') and path is not null)
    or (kind = 'embed' and url is not null and provider is not null)
    or (kind = 'link' and url is not null)
  )
);

comment on table public.activity_media is 'Photos, videos, audio, documents, links and social posts attached to a news panel activity, in display order.';

create index activity_media_activity_idx on public.activity_media (activity_id, position);

alter table public.activity_media enable row level security;
revoke all on public.activity_media from anon;
grant select on public.activity_media to anon;
grant select, insert, update, delete on public.activity_media to authenticated;

create policy "activity media: visible with the activity"
  on public.activity_media for select
  to anon, authenticated
  using (public.activity_is_public(activity_id) or (select public.is_staff()));

create policy "activity media: staff write"
  on public.activity_media for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- Existing photo galleries move over as images.
insert into public.activity_media (activity_id, kind, path, caption, position, created_at)
select activity_id, 'image', path, caption, position, created_at from public.activity_photos;

-- The "media" bucket now takes videos, audio and documents too. 50 MB per file matches Supabase's
-- default upload limit; on the Pro plan it can be raised (Storage settings, then this bucket).
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel'
    ]
where id = 'media';

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

-- Removing files through the Storage API also needs read access to them: without this policy the
-- editor (and deleting an activity) left removed photos behind in the bucket.
create policy "media: staff read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'media' and (select public.is_staff()));
