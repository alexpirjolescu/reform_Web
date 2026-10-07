-- re_form platform · resources, round two
-- 1. Personal storage: every account gets its own space (200 MB), private unless shared.
-- 2. Folders inside folders, so files and folders can be dragged into other folders.
-- 3. Sharing from personal storage with specific people.
-- 4. Library files can be read wherever their row is visible, so a file keeps working after it moves
--    to another folder (its object keeps the original path).

-- ===========================================================================
-- Folders: a third space, an owner, and a parent
-- ===========================================================================

alter table public.library_folders
  add column owner_id  uuid references public.profiles (id) on delete cascade,
  add column parent_id uuid references public.library_folders (id) on delete cascade;

alter table public.library_folders drop constraint library_folders_space_check;
alter table public.library_folders drop constraint library_folders_space_school;
alter table public.library_folders add constraint library_folders_space_check check (space in ('shared', 'school', 'personal'));
alter table public.library_folders add constraint library_folders_space_owner check (
  (space = 'shared' and school_id is null and owner_id is null)
  or (space = 'school' and school_id is not null and owner_id is null)
  or (space = 'personal' and school_id is null and owner_id is not null)
);

comment on column public.library_folders.owner_id is 'Personal space: the account it belongs to.';
comment on column public.library_folders.parent_id is 'The folder this one sits in; null = top level of its space.';

create index library_folders_owner_idx on public.library_folders (owner_id);
create index library_folders_parent_idx on public.library_folders (parent_id);

-- Who shares what from their personal space, with whom.
create table public.library_shares (
  id         uuid primary key default gen_random_uuid(),
  folder_id  uuid references public.library_folders (id) on delete cascade,
  file_id    uuid references public.library_files (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  shared_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint library_shares_one_item check ((folder_id is null) <> (file_id is null)),
  constraint library_shares_not_self check (profile_id <> shared_by)
);

-- Not partial, so they can back ON CONFLICT; rows with a null side never collide (nulls are distinct).
create unique index library_shares_folder_uq on public.library_shares (folder_id, profile_id);
create unique index library_shares_file_uq on public.library_shares (file_id, profile_id);
create index library_shares_profile_idx on public.library_shares (profile_id);

comment on table public.library_shares is 'Personal files and folders shared with someone (read-only for them; a folder share covers what is inside).';

-- ===========================================================================
-- Helpers
-- ===========================================================================

create function public.personal_quota()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 209715200::bigint $$; -- 200 MB per account

-- Bytes used in someone's personal space: its files (trash included) plus anything they uploaded
-- that no file points to (an upload whose save failed), so the limit can't be dodged.
create function public.personal_usage(who uuid, except_path text default null)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select sum(f.size_bytes) from public.library_files f
    join public.library_folders d on d.id = f.folder_id
    where d.space = 'personal' and d.owner_id = who and f.storage_path is distinct from except_path
  ), 0) + coalesce((
    select sum(coalesce((o.metadata ->> 'size')::bigint, 0)) from storage.objects o
    where o.bucket_id = 'library' and o.owner_id = who::text and o.name is distinct from except_path
      and not exists (select 1 from public.library_files f where f.storage_path = o.name)
  ), 0)
$$;

-- A folder and every folder above it.
create function public.folder_ancestors(target uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive up (id, parent_id, depth) as (
    select f.id, f.parent_id, 0 from public.library_folders f where f.id = target
    union all
    select p.id, p.parent_id, up.depth + 1 from public.library_folders p join up on p.id = up.parent_id where up.depth < 32
  )
  select id from up
$$;

create or replace function public.can_read_folder(target uuid)
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
      and (
        f.space = 'shared'
        or (f.space = 'school' and public.can_access_school(f.school_id))
        or (f.space = 'personal' and (
          f.owner_id = auth.uid()
          or exists (
            select 1 from public.library_shares s
            where s.profile_id = auth.uid() and s.folder_id in (select public.folder_ancestors(f.id))
          )
        ))
      )
  )
$$;

create or replace function public.can_write_folder(target uuid)
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
      and (
        (f.space = 'shared' and public.is_staff())
        or (f.space = 'school' and public.can_access_school(f.school_id))
        or (f.space = 'personal' and f.owner_id = auth.uid())
      )
  )
$$;

-- Uploading: writable, and a personal space below its limit.
create function public.can_upload_to_folder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write_folder(target) and not exists (
    select 1 from public.library_folders f
    where f.id = target and f.space = 'personal' and public.personal_usage(f.owner_id) >= public.personal_quota()
  )
$$;

-- A stored object can be read by anyone who can see a file pointing at it.
create function public.can_read_library_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_files f
    where f.storage_path = object_name
      and (
        public.can_read_folder(f.folder_id)
        or exists (select 1 from public.library_shares s where s.file_id = f.id and s.profile_id = auth.uid())
      )
  )
$$;

-- What is inside a personal folder belongs to its owner: they decide who sees it.
create function public.owns_personal_item(target_folder uuid, target_file uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_folders d
    where d.space = 'personal' and d.owner_id = auth.uid()
      and d.id = coalesce(target_folder, (select f.folder_id from public.library_files f where f.id = target_file))
  )
$$;

revoke all on function public.personal_usage(uuid, text), public.folder_ancestors(uuid), public.can_upload_to_folder(uuid),
  public.can_read_library_object(text), public.owns_personal_item(uuid, uuid) from public, anon;
grant execute on function public.personal_quota(), public.personal_usage(uuid, text), public.folder_ancestors(uuid),
  public.can_upload_to_folder(uuid), public.can_read_library_object(text), public.owns_personal_item(uuid, uuid) to authenticated;

-- What the signed-in person uses of their own space.
create function public.my_personal_storage()
returns table (used bigint, quota bigint)
language sql
stable
security definer
set search_path = ''
as $$ select public.personal_usage(auth.uid()), public.personal_quota() $$;

revoke all on function public.my_personal_storage() from public, anon;
grant execute on function public.my_personal_storage() to authenticated;

-- ===========================================================================
-- Keeping the tree sound
-- ===========================================================================

-- A folder takes its space from its parent; it can't move into itself or below itself.
create function public.check_library_folder()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.library_folders;
begin
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    select * into parent from public.library_folders where id = new.parent_id;
    if not found then
      raise exception 'unknown parent folder' using errcode = '23503';
    end if;
    if tg_op = 'UPDATE' and new.id in (select public.folder_ancestors(new.parent_id)) then
      raise exception 'a folder cannot go inside itself' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' then
      new.space := parent.space;
      new.school_id := parent.school_id;
      new.owner_id := parent.owner_id;
    elsif (parent.space, parent.school_id, parent.owner_id) is distinct from (new.space, new.school_id, new.owner_id) then
      raise exception 'folders move between spaces with move_library_folder' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger library_folders_check
  before insert or update on public.library_folders
  for each row execute function public.check_library_folder();

-- Sizes come from storage, not from the browser; personal spaces stay under their limit.
create function public.check_library_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored bigint;
  owner uuid;
begin
  if tg_op = 'INSERT' and new.storage_path is not null then
    select (o.metadata ->> 'size')::bigint into stored from storage.objects o where o.bucket_id = 'library' and o.name = new.storage_path;
    if stored is not null then new.size_bytes := stored; end if;
  end if;
  if tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id then
    select d.owner_id into owner from public.library_folders d where d.id = new.folder_id and d.space = 'personal';
    if owner is not null and (tg_op = 'INSERT' or not exists (
      select 1 from public.library_folders d where d.id = old.folder_id and d.space = 'personal' and d.owner_id = owner
    )) and public.personal_usage(owner, new.storage_path) + new.size_bytes > public.personal_quota() then
      raise exception 'personal storage is full' using errcode = '53100', hint = 'quota';
    end if;
  end if;
  return new;
end
$$;

create trigger library_files_check
  before insert or update of folder_id on public.library_files
  for each row execute function public.check_library_file();

-- Moving a personal folder (with everything in it) into the shared library or a school space.
create function public.move_library_folder(target uuid, new_parent uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  folder public.library_folders;
  parent public.library_folders;
begin
  select * into folder from public.library_folders where id = target;
  if not found or not (public.is_staff() or folder.created_by = auth.uid() or (folder.space = 'personal' and folder.owner_id = auth.uid())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new_parent is null then
    update public.library_folders set parent_id = null where id = target;
    return;
  end if;
  select * into parent from public.library_folders where id = new_parent;
  if not found or not public.can_write_folder(new_parent) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if target in (select public.folder_ancestors(new_parent)) then
    raise exception 'a folder cannot go inside itself' using errcode = '23514';
  end if;
  if (parent.space, parent.school_id, parent.owner_id) is not distinct from (folder.space, folder.school_id, folder.owner_id) then
    update public.library_folders set parent_id = new_parent where id = target;
    return;
  end if;
  -- Across spaces: only out of one's own personal space (sharing work with the team), never into it.
  if folder.space <> 'personal' or parent.space = 'personal' then
    raise exception 'only personal folders move to another space' using errcode = '42501';
  end if;
  with recursive down (id) as (
    select target
    union all
    select c.id from public.library_folders c join down on c.parent_id = down.id
  )
  update public.library_folders f
  set space = parent.space, school_id = parent.school_id, owner_id = parent.owner_id,
      parent_id = case when f.id = target then new_parent else f.parent_id end
  where f.id in (select id from down);
end
$$;

revoke all on function public.move_library_folder(uuid, uuid) from public, anon;
grant execute on function public.move_library_folder(uuid, uuid) to authenticated;

-- Space, school and owner change only through move_library_folder; sizes and paths never change.
revoke update on public.library_folders from authenticated;
grant update (name, parent_id) on public.library_folders to authenticated;
revoke update on public.library_files from authenticated;
grant update (name, description, tags, folder_id, deleted_at) on public.library_files to authenticated;

-- ===========================================================================
-- Access
-- ===========================================================================

create policy "folders: own personal folders"
  on public.library_folders for insert
  to authenticated
  with check (created_by = (select auth.uid()) and space = 'personal' and owner_id = (select auth.uid()));

create policy "folders: owners delete personal folders"
  on public.library_folders for delete
  to authenticated
  using (space = 'personal' and owner_id = (select auth.uid()));

create policy "files: shared with me"
  on public.library_files for select
  to authenticated
  using (deleted_at is null and exists (
    select 1 from public.library_shares s where s.file_id = library_files.id and s.profile_id = (select auth.uid())
  ));

create policy "files: owners delete personal files"
  on public.library_files for delete
  to authenticated
  using (public.owns_personal_item(folder_id, null));

alter table public.library_shares enable row level security;
revoke all on public.library_shares from anon;
revoke update on public.library_shares from authenticated;

create policy "shares: the two people involved see them"
  on public.library_shares for select
  to authenticated
  using (shared_by = (select auth.uid()) or profile_id = (select auth.uid()));

create policy "shares: owners share with people they can message"
  on public.library_shares for insert
  to authenticated
  with check (shared_by = (select auth.uid()) and public.can_message(profile_id) and public.owns_personal_item(folder_id, file_id));

create policy "shares: either side removes them"
  on public.library_shares for delete
  to authenticated
  using (shared_by = (select auth.uid()) or profile_id = (select auth.uid()));

-- Storage: upload under the limit; read what you can see; owners clean up their personal files and failed uploads.
alter policy "library objects: upload into writable folders"
  on storage.objects
  with check (bucket_id = 'library' and public.can_upload_to_folder(public.try_uuid((storage.foldername(name))[1])));

create policy "library objects: read files you can see"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'library' and public.can_read_library_object(name));

create policy "library objects: owners delete their personal files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'library' and owner_id = (select auth.uid())::text
    and (
      not exists (select 1 from public.library_files f where f.storage_path = objects.name)
      or exists (
        select 1 from public.library_files f join public.library_folders d on d.id = f.folder_id
        where f.storage_path = objects.name and d.space = 'personal' and d.owner_id = (select auth.uid())
      )
    )
  );

-- ===========================================================================
-- Everyone starts with one personal folder
-- ===========================================================================

create function public.create_personal_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.library_folders (space, owner_id, name, created_by) values ('personal', new.id, 'Fișierele mele', new.id);
  return new;
end
$$;

revoke all on function public.create_personal_folder() from public, anon, authenticated;

create trigger profiles_create_personal_folder
  after insert on public.profiles
  for each row execute function public.create_personal_folder();

insert into public.library_folders (space, owner_id, name, created_by)
select 'personal', p.id, 'Fișierele mele', p.id from public.profiles p
where not exists (select 1 from public.library_folders f where f.space = 'personal' and f.owner_id = p.id);
