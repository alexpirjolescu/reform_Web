-- re_form platform · theme preference, shared helpers, news panel (PRD module 1)

-- ---------------------------------------------------------------------------
-- Theme preference: white (design B), dark (design A), color (design C)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column theme text not null default 'white' check (theme in ('white', 'dark', 'color'));

grant update (theme) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end
$$;

create function public.can_access_school(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
    or (target_school is not null and target_school = public.current_school_id())
$$;

revoke all on function public.can_access_school(uuid) from public;
grant execute on function public.can_access_school(uuid) to authenticated;
grant execute on function public.try_uuid(text) to anon, authenticated;

-- Partner schools are public (the news panel filters by school and lists partners).
alter policy "schools: active accounts can read" on public.schools rename to "schools: everyone can read";
alter policy "schools: everyone can read" on public.schools to anon, authenticated using (true);
grant select on public.schools to anon;

-- ---------------------------------------------------------------------------
-- Activities (news panel)
-- ---------------------------------------------------------------------------

create type public.activity_category as enum ('workshop', 'meeting', 'event', 'showcase');

create table public.activities (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null check (length(trim(title)) between 3 and 160),
  summary                 text not null default '' check (length(summary) <= 400),
  body                    text not null default '',
  category                public.activity_category not null,
  starts_at               timestamptz not null,
  ends_at                 timestamptz,
  location                text not null default '',
  cover_path              text,
  status                  text not null default 'draft' check (status in ('draft', 'published')),
  publish_at              timestamptz not null default now(),
  photo_consent_confirmed boolean not null default false,
  is_demo                 boolean not null default false,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint activities_end_after_start check (ends_at is null or ends_at >= starts_at)
);

comment on table public.activities is 'Workshops, meetings, events and showcases shown on the public news panel.';
comment on column public.activities.publish_at is 'Scheduled publishing: a published activity is public only from this moment.';
comment on column public.activities.photo_consent_confirmed is 'Staff confirmed consent for every student who appears in its photos (PRD, photo consent).';

create index activities_starts_at_idx on public.activities (starts_at);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create table public.activity_schools (
  activity_id uuid not null references public.activities (id) on delete cascade,
  school_id   uuid not null references public.schools (id) on delete cascade,
  primary key (activity_id, school_id)
);

create index activity_schools_school_idx on public.activity_schools (school_id);

create table public.activity_photos (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  path        text not null,
  caption     text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index activity_photos_activity_idx on public.activity_photos (activity_id, position);

create function public.activity_is_public(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activities a
    where a.id = target and a.status = 'published' and a.publish_at <= now()
  )
$$;

revoke all on function public.activity_is_public(uuid) from public;
grant execute on function public.activity_is_public(uuid) to anon, authenticated;

alter table public.activities       enable row level security;
alter table public.activity_schools enable row level security;
alter table public.activity_photos  enable row level security;

grant select on public.activities, public.activity_schools, public.activity_photos to anon;

create policy "activities: published ones are public"
  on public.activities for select
  to anon, authenticated
  using (status = 'published' and publish_at <= now());

create policy "activities: staff read all"
  on public.activities for select
  to authenticated
  using ((select public.is_staff()));

create policy "activities: staff insert"
  on public.activities for insert
  to authenticated
  with check ((select public.is_staff()));

create policy "activities: staff update"
  on public.activities for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "activities: staff delete"
  on public.activities for delete
  to authenticated
  using ((select public.is_staff()));

create policy "activity schools: visible with the activity"
  on public.activity_schools for select
  to anon, authenticated
  using (public.activity_is_public(activity_id) or (select public.is_staff()));

create policy "activity schools: staff write"
  on public.activity_schools for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "activity photos: visible with the activity"
  on public.activity_photos for select
  to anon, authenticated
  using (public.activity_is_public(activity_id) or (select public.is_staff()));

create policy "activity photos: staff write"
  on public.activity_photos for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- "Academy at a glance" numbers (NP-6) and the newsletter sign-up (NP-9)
-- ---------------------------------------------------------------------------

create function public.public_stats()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'schools',    (select count(*) from public.schools),
    'students',   (select count(*) from public.profiles where role in ('student', 'core_lead') and deactivated_at is null),
    'activities', (select count(*) from public.activities where status = 'published' and publish_at <= now()),
    'this_year',  (select count(*) from public.activities
                   where status = 'published' and publish_at <= now()
                     and starts_at >= date_trunc('year', now()) and starts_at < now())
  )
$$;

revoke all on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;

create table public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale     text not null default 'ro' check (locale in ('ro', 'en')),
  created_at timestamptz not null default now()
);

comment on table public.newsletter_subscribers is 'Emails that asked for the monthly newsletter. Written only through subscribe_newsletter().';

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;

create policy "newsletter: admins read"
  on public.newsletter_subscribers for select
  to authenticated
  using ((select public.is_admin()));
grant select on public.newsletter_subscribers to authenticated;

create function public.subscribe_newsletter(subscriber_email text, subscriber_locale text default 'ro')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if subscriber_email is null or subscriber_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(subscriber_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  insert into public.newsletter_subscribers (email, locale)
  values (lower(trim(subscriber_email)), case when subscriber_locale = 'en' then 'en' else 'ro' end)
  on conflict (email) do nothing;
end
$$;

revoke all on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public "media" bucket for activity covers and photos (staff upload)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "media: staff upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and (select public.is_staff()));

create policy "media: staff update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and (select public.is_staff()));

create policy "media: staff delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and (select public.is_staff()));
