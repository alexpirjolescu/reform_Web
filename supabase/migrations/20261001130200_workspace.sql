-- re_form platform · workspace (PRD module 2): boards, columns, cards per school

create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  due_date    date,
  is_demo     boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

comment on column public.boards.due_date is 'Optional project deadline (for example a demo day), shown as a countdown.';

create index boards_school_idx on public.boards (school_id);

create table public.board_columns (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  position   double precision not null default 0,
  is_done    boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.board_columns.is_done is 'Cards in this column count as finished in progress figures.';

create index board_columns_board_idx on public.board_columns (board_id, position);

create table public.cards (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  column_id   uuid not null references public.board_columns (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  due_date    date,
  position    double precision not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index cards_board_idx on public.cards (board_id);
create index cards_column_idx on public.cards (column_id, position);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create table public.card_labels (
  id      uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  name    text not null check (length(trim(name)) between 1 and 30),
  color   text not null default 'teal' check (color in ('teal', 'honey', 'lavender', 'vermilion', 'lime', 'pink'))
);

create index card_labels_card_idx on public.card_labels (card_id);

create table public.card_assignees (
  card_id    uuid not null references public.cards (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (card_id, profile_id)
);

create index card_assignees_profile_idx on public.card_assignees (profile_id);

create table public.checklist_items (
  id       uuid primary key default gen_random_uuid(),
  card_id  uuid not null references public.cards (id) on delete cascade,
  label    text not null check (length(trim(label)) between 1 and 200),
  done     boolean not null default false,
  position double precision not null default 0
);

create index checklist_items_card_idx on public.checklist_items (card_id, position);

create table public.card_comments (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index card_comments_card_idx on public.card_comments (card_id, created_at);

create table public.card_attachments (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  file_id    uuid not null references public.library_files (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (card_id, file_id)
);

create table public.card_events (
  id         bigint generated always as identity primary key,
  card_id    uuid not null references public.cards (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.card_events is 'History of each card (WS-8): who created, moved or edited it, and when. Written by triggers.';

create index card_events_card_idx on public.card_events (card_id, created_at);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create function public.can_access_board(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b
    where b.id = target and public.can_access_school(b.school_id)
  )
$$;

create function public.can_manage_boards(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
    or (public.current_app_role() = 'core_lead' and target_school = public.current_school_id())
$$;

create function public.can_access_card(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cards c
    where c.id = target and public.can_access_board(c.board_id)
  )
$$;

revoke all on function public.can_access_board(uuid)  from public;
revoke all on function public.can_manage_boards(uuid) from public;
revoke all on function public.can_access_card(uuid)   from public;
grant execute on function public.can_access_board(uuid)  to authenticated;
grant execute on function public.can_manage_boards(uuid) to authenticated;
grant execute on function public.can_access_card(uuid)   to authenticated;

-- A card's column must belong to the card's board.
create function public.check_card_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.board_columns bc where bc.id = new.column_id and bc.board_id = new.board_id) then
    raise exception 'column % is not on board %', new.column_id, new.board_id using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger cards_check_column
  before insert or update of column_id, board_id on public.cards
  for each row execute function public.check_card_column();

-- Card history (WS-8)
create function public.log_card_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.card_events (card_id, actor_id, kind, details)
    values (new.id, auth.uid(), 'created', jsonb_build_object('column_id', new.column_id));
  elsif new.column_id is distinct from old.column_id then
    insert into public.card_events (card_id, actor_id, kind, details)
    values (new.id, auth.uid(), 'moved', jsonb_build_object('from', old.column_id, 'to', new.column_id));
  elsif new.title is distinct from old.title or new.description is distinct from old.description
        or new.due_date is distinct from old.due_date then
    insert into public.card_events (card_id, actor_id, kind, details)
    values (new.id, auth.uid(), 'edited', '{}'::jsonb);
  end if;
  return new;
end
$$;

create trigger cards_log_event
  after insert or update on public.cards
  for each row execute function public.log_card_event();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.boards           enable row level security;
alter table public.board_columns    enable row level security;
alter table public.cards            enable row level security;
alter table public.card_labels      enable row level security;
alter table public.card_assignees   enable row level security;
alter table public.checklist_items  enable row level security;
alter table public.card_comments    enable row level security;
alter table public.card_attachments enable row level security;
alter table public.card_events      enable row level security;

revoke all on public.boards, public.board_columns, public.cards, public.card_labels, public.card_assignees,
  public.checklist_items, public.card_comments, public.card_attachments, public.card_events from anon;
revoke insert, update, delete on public.card_events from authenticated;

create policy "boards: school members and staff read"
  on public.boards for select to authenticated
  using (public.can_access_school(school_id));

create policy "boards: core leads and staff create"
  on public.boards for insert to authenticated
  with check (public.can_manage_boards(school_id) and created_by = (select auth.uid()));

create policy "boards: core leads and staff edit"
  on public.boards for update to authenticated
  using (public.can_manage_boards(school_id))
  with check (public.can_manage_boards(school_id));

create policy "boards: core leads and staff delete"
  on public.boards for delete to authenticated
  using (public.can_manage_boards(school_id));

create policy "columns: board members read and edit"
  on public.board_columns for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

create policy "cards: board members read and edit"
  on public.cards for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

create policy "labels: card members read and edit"
  on public.card_labels for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

create policy "assignees: card members read and edit"
  on public.card_assignees for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

create policy "checklist: card members read and edit"
  on public.checklist_items for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

create policy "comments: card members read"
  on public.card_comments for select to authenticated
  using (public.can_access_card(card_id));

create policy "comments: card members write as themselves"
  on public.card_comments for insert to authenticated
  with check (public.can_access_card(card_id) and author_id = (select auth.uid()));

create policy "comments: authors delete their own"
  on public.card_comments for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "attachments: card members read and edit"
  on public.card_attachments for all to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id) and public.can_read_folder((select f.folder_id from public.library_files f where f.id = file_id)));

create policy "events: card members read"
  on public.card_events for select to authenticated
  using (public.can_access_card(card_id));

-- Live updates for boards (WS-9)
alter publication supabase_realtime add table public.board_columns, public.cards, public.card_comments,
  public.checklist_items, public.card_labels, public.card_assignees;
