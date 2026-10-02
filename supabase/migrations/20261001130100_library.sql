-- re_form platform · resource library (PRD module 3)
-- Two kinds of space: the shared re_form library (staff upload, everyone reads)
-- and one space per school (its core team and staff read and write).

create table public.library_folders (
  id         uuid primary key default gen_random_uuid(),
  space      text not null check (space in ('shared', 'school')),
  school_id  uuid references public.schools (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 80),
  is_demo    boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint library_folders_space_school check ((space = 'shared') = (school_id is null))
);

create index library_folders_school_idx on public.library_folders (school_id);

create table public.library_files (
  id           uuid primary key default gen_random_uuid(),
  folder_id    uuid not null references public.library_folders (id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 200),
  description  text not null default '',
  mime_type    text not null default 'application/octet-stream',
  size_bytes   bigint not null default 0 check (size_bytes >= 0),
  storage_path text unique,
  external_url text check (external_url ~ '^https://[^\s]+$' and length(external_url) <= 2000),
  tags         text[] not null default '{}',
  is_demo      boolean not null default false,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- Either an uploaded file or a link (long recordings live on YouTube/Drive: storage caps files at 50 MB).
  constraint library_files_file_or_link check ((storage_path is null) <> (external_url is null))
);

comment on column public.library_files.deleted_at is 'Soft delete: the file sits in the trash and can be restored for 30 days.';

create index library_files_folder_idx on public.library_files (folder_id, created_at desc);

create function public.can_read_folder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_folders f
    where f.id = target
      and public.current_app_role() is not null
      and (f.space = 'shared' or public.can_access_school(f.school_id))
  )
$$;

create function public.can_write_folder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_folders f
    where f.id = target
      and (
        (f.space = 'shared' and public.is_staff())
        or (f.space = 'school' and public.can_access_school(f.school_id))
      )
  )
$$;

revoke all on function public.can_read_folder(uuid)  from public;
revoke all on function public.can_write_folder(uuid) from public;
grant execute on function public.can_read_folder(uuid)  to authenticated;
grant execute on function public.can_write_folder(uuid) to authenticated;

alter table public.library_folders enable row level security;
alter table public.library_files   enable row level security;
revoke all on public.library_folders, public.library_files from anon;

create policy "folders: read shared and own school"
  on public.library_folders for select
  to authenticated
  using (public.can_read_folder(id));

create policy "folders: staff create shared, members create in own school"
  on public.library_folders for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and ((space = 'shared' and (select public.is_staff())) or (space = 'school' and public.can_access_school(school_id)))
  );

create policy "folders: staff or creator rename and delete"
  on public.library_folders for update
  to authenticated
  using ((select public.is_staff()) or created_by = (select auth.uid()))
  with check ((select public.is_staff()) or created_by = (select auth.uid()));

create policy "folders: staff delete"
  on public.library_folders for delete
  to authenticated
  using ((select public.is_staff()));

create policy "files: read in readable folders"
  on public.library_files for select
  to authenticated
  using (
    public.can_read_folder(folder_id)
    and (deleted_at is null or uploaded_by = (select auth.uid()) or (select public.is_staff()))
  );

create policy "files: upload into writable folders"
  on public.library_files for insert
  to authenticated
  with check (uploaded_by = (select auth.uid()) and public.can_write_folder(folder_id));

create policy "files: uploader or staff edit and trash"
  on public.library_files for update
  to authenticated
  using (uploaded_by = (select auth.uid()) or (select public.is_staff()))
  with check (public.can_write_folder(folder_id) or (select public.is_staff()));

create policy "files: staff delete permanently"
  on public.library_files for delete
  to authenticated
  using ((select public.is_staff()));

-- Storage: private "library" bucket; object path = <folder id>/<random>-<file name>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library', 'library', false, 52428800,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;

create policy "library objects: read in readable folders"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'library' and public.can_read_folder(public.try_uuid((storage.foldername(name))[1])));

create policy "library objects: upload into writable folders"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'library' and public.can_write_folder(public.try_uuid((storage.foldername(name))[1])));

create policy "library objects: staff delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'library' and (select public.is_staff()));
