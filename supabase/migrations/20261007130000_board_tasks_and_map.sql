-- re_form platform · project boards, round two
-- Checklist items get owners and remember who ticked them, comments get replies, and every
-- project gets a concept map that tells its story: need → solution → making → delivery → impact.
-- No DELETE or DROP statements, so the Supabase connector can apply it without a confirmation.

-- ===========================================================================
-- Checklist: who ticked an item, and who is responsible for it
-- ===========================================================================

alter table public.checklist_items
  add column done_by uuid references public.profiles (id) on delete set null,
  add column done_at timestamptz;

comment on column public.checklist_items.done_by is 'Who last ticked the item. Set by the database (not the browser), cleared when unticked.';

create function public.stamp_checklist_done()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.done then
      new.done_by := auth.uid();
      new.done_at := now();
    else
      new.done_by := null;
      new.done_at := null;
    end if;
  elsif new.done and not old.done then
    new.done_by := auth.uid();
    new.done_at := now();
  elsif not new.done then
    new.done_by := null;
    new.done_at := null;
  else
    new.done_by := old.done_by;
    new.done_at := old.done_at;
  end if;
  return new;
end
$$;

create trigger checklist_items_stamp_done
  before insert or update on public.checklist_items
  for each row execute function public.stamp_checklist_done();

create table public.checklist_item_assignees (
  item_id    uuid not null references public.checklist_items (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (item_id, profile_id)
);

create index checklist_item_assignees_profile_idx on public.checklist_item_assignees (profile_id);

create function public.can_access_checklist_item(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.checklist_items i
    where i.id = target and public.can_access_card(i.card_id)
  )
$$;

revoke all on function public.can_access_checklist_item(uuid) from public;
grant execute on function public.can_access_checklist_item(uuid) to authenticated;

alter table public.checklist_item_assignees enable row level security;
revoke all on public.checklist_item_assignees from anon;

create policy "checklist owners: card members read and edit"
  on public.checklist_item_assignees for all to authenticated
  using (public.can_access_checklist_item(item_id))
  with check (public.can_access_checklist_item(item_id));

-- ===========================================================================
-- Comments: replies (one level, like comments in a document)
-- ===========================================================================

alter table public.card_comments
  add column parent_id uuid references public.card_comments (id) on delete cascade;

comment on column public.card_comments.parent_id is 'The comment this one answers. Replies answer a top-level comment on the same task.';

create index card_comments_parent_idx on public.card_comments (parent_id);

create function public.check_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.card_comments p
    where p.id = new.parent_id and p.card_id = new.card_id and p.parent_id is null
  ) then
    raise exception 'a reply must answer a comment on the same task' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger card_comments_check_parent
  before insert or update of parent_id, card_id on public.card_comments
  for each row execute function public.check_comment_parent();

-- ===========================================================================
-- The project story: every task can belong to a step
-- ===========================================================================

alter table public.cards
  add column stage text check (stage in ('need', 'solution', 'build', 'deliver', 'impact'));

comment on column public.cards.stage is 'Step of the project story the task serves: need, solution, build (making it), deliver, impact.';

-- ===========================================================================
-- Concept map per project (CmapTools-style): concepts joined by labelled links
-- ===========================================================================

create table public.board_map_nodes (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  -- stage: one per step, made by the database; card: a task (follows cards.stage); concept: the team's own idea
  kind       text not null check (kind in ('stage', 'concept', 'card')),
  stage      text check (stage in ('need', 'solution', 'build', 'deliver', 'impact')),
  card_id    uuid references public.cards (id) on delete cascade,
  label      text not null default '' check (length(label) <= 300),
  note       text not null default '' check (length(note) <= 2000),
  color      text check (color is null or color in ('teal', 'honey', 'lavender', 'vermilion', 'lime', 'pink')),
  -- Position on the map; null = placed automatically in its step's lane.
  x          real,
  y          real,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_map_nodes_shape check (
    (kind = 'stage' and stage is not null and card_id is null)
    or (kind = 'card' and card_id is not null)
    or (kind = 'concept' and card_id is null)
  )
);

comment on table public.board_map_nodes is 'Concepts on a project''s map: the five story steps, its tasks and the team''s own ideas.';

create unique index board_map_nodes_stage_uq on public.board_map_nodes (board_id, stage) where kind = 'stage';
create unique index board_map_nodes_card_uq on public.board_map_nodes (card_id) where kind = 'card';
create index board_map_nodes_board_idx on public.board_map_nodes (board_id);

create trigger board_map_nodes_set_updated_at
  before update on public.board_map_nodes
  for each row execute function public.set_updated_at();

create table public.board_map_links (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  from_node  uuid not null references public.board_map_nodes (id) on delete cascade,
  to_node    uuid not null references public.board_map_nodes (id) on delete cascade,
  -- The linking phrase that makes the pair a sentence: "nevoia — se rezolvă prin → soluția".
  label      text not null default '' check (length(label) <= 80),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint board_map_links_not_self check (from_node <> to_node),
  unique (from_node, to_node)
);

comment on table public.board_map_links is 'Labelled links between map concepts (propositions).';

create index board_map_links_board_idx on public.board_map_links (board_id);
create index board_map_links_to_idx on public.board_map_links (to_node);

-- Nodes keep their identity: a step stays a step, a task stays its task, on the same board.
create function public.check_map_node()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.kind <> old.kind or new.stage is distinct from old.stage and old.kind = 'stage'
      or new.card_id is distinct from old.card_id or new.board_id <> old.board_id) then
    raise exception 'a map node cannot change what it stands for' using errcode = '23514';
  end if;
  if new.kind = 'card' and not exists (select 1 from public.cards c where c.id = new.card_id and c.board_id = new.board_id) then
    raise exception 'the task is not on this board' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger board_map_nodes_check
  before insert or update on public.board_map_nodes
  for each row execute function public.check_map_node();

create function public.check_map_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.board_map_nodes n where n.id in (new.from_node, new.to_node) and n.board_id = new.board_id) <> 2 then
    raise exception 'both concepts must be on this board' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger board_map_links_check
  before insert or update on public.board_map_links
  for each row execute function public.check_map_link();

-- Every project starts with its five steps, joined into a sentence the team can rewrite.
create function public.seed_board_map(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stages text[] := array['need', 'solution', 'build', 'deliver', 'impact'];
  phrases text[] := array['se rezolvă prin', 'prinde formă prin', 'ajunge la oameni prin', 'are ca efect'];
  ids uuid[] := '{}';
  node uuid;
  i integer;
begin
  if exists (select 1 from public.board_map_nodes where board_id = target and kind = 'stage') then
    return;
  end if;
  for i in 1 .. array_length(stages, 1) loop
    insert into public.board_map_nodes (board_id, kind, stage, created_by)
    values (target, 'stage', stages[i], null)
    returning id into node;
    ids := ids || node;
  end loop;
  for i in 1 .. array_length(phrases, 1) loop
    insert into public.board_map_links (board_id, from_node, to_node, label, created_by)
    values (target, ids[i], ids[i + 1], phrases[i], null);
  end loop;
end
$$;

revoke all on function public.seed_board_map(uuid) from public;

create function public.seed_board_map_on_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_board_map(new.id);
  return new;
end
$$;

create trigger boards_seed_map
  after insert on public.boards
  for each row execute function public.seed_board_map_on_create();

select public.seed_board_map(id) from public.boards;

-- A task with a step gets its place on the map; changing the step puts it back in the new lane.
create function public.sync_card_map_node()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage is not null then
    insert into public.board_map_nodes (board_id, kind, card_id, created_by)
    values (new.board_id, 'card', new.id, auth.uid())
    on conflict (card_id) where kind = 'card' do nothing;
  end if;
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    update public.board_map_nodes set x = null, y = null where kind = 'card' and card_id = new.id;
  end if;
  return new;
end
$$;

create trigger cards_sync_map_node
  after insert or update of stage on public.cards
  for each row execute function public.sync_card_map_node();

-- ---------------------------------------------------------------------------
-- Access: everyone on the project's school team (and staff) reads and edits the map.
-- Steps are made by the database and can't be removed; a task leaves the map by losing its step.
-- ---------------------------------------------------------------------------

alter table public.board_map_nodes enable row level security;
alter table public.board_map_links enable row level security;
revoke all on public.board_map_nodes, public.board_map_links from anon;

create policy "map nodes: board members read"
  on public.board_map_nodes for select to authenticated
  using (public.can_access_board(board_id));

create policy "map nodes: board members add concepts"
  on public.board_map_nodes for insert to authenticated
  with check (public.can_access_board(board_id) and kind <> 'stage');

create policy "map nodes: board members edit"
  on public.board_map_nodes for update to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

create policy "map nodes: board members remove concepts"
  on public.board_map_nodes for delete to authenticated
  using (public.can_access_board(board_id) and kind = 'concept');

create policy "map links: board members read and edit"
  on public.board_map_links for all to authenticated
  using (public.can_access_board(board_id))
  with check (public.can_access_board(board_id));

-- Live updates
alter publication supabase_realtime add table public.board_map_nodes, public.board_map_links, public.checklist_item_assignees;
