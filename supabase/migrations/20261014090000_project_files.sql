-- re_form platform · files in tasks
-- 1. Every project has a folder in its school's library, named after the project and renamed with it.
-- 2. A file uploaded into a task is saved in the uploader's personal space (it counts towards their 200 MB)
--    and attached to the task. The project's folder lists every file attached to the project's tasks,
--    wherever the file is stored.
-- 3. A personal file attached to a task can be read by everyone who works on that project; only its owner
--    can attach it, so nobody shares someone else's personal file by attaching it.
-- 4. Folder rows are checked by their own columns, so a folder can be read back by the insert that creates
--    it (this was the "new row violates row-level security policy for table library_folders" error).

-- ===========================================================================
-- Project folders
-- ===========================================================================

alter table public.library_folders add column board_id uuid references public.boards (id) on delete set null;
create unique index library_folders_board_uq on public.library_folders (board_id);
comment on column public.library_folders.board_id is 'The project (board) whose resources this school folder holds; it also lists the files attached to the project''s tasks.';

create function public.create_project_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.library_folders (space, school_id, name, created_by, board_id, is_demo)
  values ('school', new.school_id, left(trim(new.name), 80), new.created_by, new.id, new.is_demo);
  return new;
end
$$;

create trigger boards_create_project_folder
  after insert on public.boards
  for each row execute function public.create_project_folder();

create function public.rename_project_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.library_folders set name = left(trim(new.name), 80) where board_id = new.id;
  return new;
end
$$;

create trigger boards_rename_project_folder
  after update of name on public.boards
  for each row when (new.name is distinct from old.name)
  execute function public.rename_project_folder();

revoke all on function public.create_project_folder(), public.rename_project_folder() from public, anon, authenticated;

insert into public.library_folders (space, school_id, name, created_by, board_id, is_demo)
select 'school', b.school_id, left(trim(b.name), 80), b.created_by, b.id, b.is_demo
from public.boards b
where not exists (select 1 from public.library_folders f where f.board_id = b.id);

-- ===========================================================================
-- Files attached to tasks
-- ===========================================================================

-- Attached to a task of a project the signed-in person works on.
create function public.file_on_my_boards(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.card_attachments a
    join public.cards c on c.id = a.card_id
    where a.file_id = target and public.can_access_board(c.board_id)
  )
$$;

-- Attaching: a file you can read, and if it is personal, your own.
create function public.can_attach_file(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_files f
    join public.library_folders d on d.id = f.folder_id
    where f.id = target and f.deleted_at is null
      and public.can_read_folder(d.id)
      and (d.space <> 'personal' or d.owner_id = auth.uid())
  )
$$;

-- A personal folder (or one above it) shared with the signed-in person.
create function public.folder_shared_with_me(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_shares s
    where s.profile_id = auth.uid() and s.folder_id in (select public.folder_ancestors(target))
  )
$$;

-- A stored object can be read by anyone who can see a file pointing at it, including through a task.
create or replace function public.can_read_library_object(object_name text)
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
        or (f.deleted_at is null and public.file_on_my_boards(f.id))
      )
  )
$$;

revoke all on function public.file_on_my_boards(uuid), public.can_attach_file(uuid), public.folder_shared_with_me(uuid) from public, anon;
grant execute on function public.file_on_my_boards(uuid), public.can_attach_file(uuid), public.folder_shared_with_me(uuid) to authenticated;

-- ===========================================================================
-- Access
-- ===========================================================================

-- Same rule as can_read_folder, written on the row itself so a freshly inserted folder passes too.
alter policy "folders: read shared and own school"
  on public.library_folders
  using (
    (select public.current_app_role()) is not null
    and (
      space = 'shared'
      or (space = 'school' and public.can_access_school(school_id))
      or (space = 'personal' and (owner_id = (select auth.uid()) or public.folder_shared_with_me(id)))
    )
  );

create policy "files: attached to tasks I can see"
  on public.library_files for select
  to authenticated
  using (deleted_at is null and public.file_on_my_boards(id));

alter policy "attachments: card members read and edit"
  on public.card_attachments
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id) and public.can_attach_file(file_id));
