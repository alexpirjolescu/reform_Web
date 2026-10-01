-- re_form platform · foundation: schools, profiles, roles, audit log
--
-- Access model (PRD, "Accounts, roles and permissions"):
--   * There is no public sign-up. Staff invite every account (see src/app/app/admin/users).
--   * A student belongs to exactly one school; staff and admins work across all schools.
--   * The database enforces access with row level security (RLS). The UI only mirrors these rules.
--   * Writes that change roles, schools or accounts go through server code that uses the
--     service-role (secret) key after checking that the caller is an admin.

-- ---------------------------------------------------------------------------
-- Types and tables
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('student', 'core_lead', 'staff', 'admin');

comment on type public.app_role is
  'student: core team member · core_lead: student who also manages their school''s workspace · staff: re_form team · admin: staff who manage accounts, schools and settings';

create table public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  city       text,
  created_at timestamptz not null default now()
);

comment on table public.schools is 'Partner high schools. Each one has a core team and its own workspace.';

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null default '',
  role            public.app_role not null default 'student',
  school_id       uuid references public.schools (id) on delete restrict,
  graduation_year smallint check (graduation_year between 2000 and 2100),
  avatar_path     text,
  locale          text not null default 'ro' check (locale in ('ro', 'en')),
  deactivated_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_students_have_a_school
    check (role in ('staff', 'admin') or school_id is not null)
);

comment on table public.profiles is 'One row per account. Role and school decide what the person can see.';
comment on column public.profiles.deactivated_at is 'Set when a student graduates or leaves; a deactivated account loses all access.';

create index profiles_school_id_idx on public.profiles (school_id);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.audit_log is 'Admin actions (account, permission and deletion changes), written by server code.';

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- security definer lets policies read profiles without recursing into profiles' own policies.
-- ---------------------------------------------------------------------------

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.deactivated_at is null
$$;

create function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.school_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.deactivated_at is null
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('staff', 'admin'), false)
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

revoke all on function public.current_app_role()  from public;
revoke all on function public.current_school_id() from public;
revoke all on function public.is_staff()          from public;
revoke all on function public.is_admin()          from public;
grant execute on function public.current_app_role()  to authenticated;
grant execute on function public.current_school_id() to authenticated;
grant execute on function public.is_staff()          to authenticated;
grant execute on function public.is_admin()          to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Table privileges
-- Visitors (anon) never touch these tables. Signed-in users read through RLS and may only
-- edit a few columns of their own profile; everything else goes through admin server code.
-- ---------------------------------------------------------------------------

revoke all on public.schools   from anon;
revoke all on public.profiles  from anon;
revoke all on public.audit_log from anon;

revoke insert, update, delete, truncate on public.schools   from authenticated;
revoke insert, update, delete, truncate on public.profiles  from authenticated;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
grant update (full_name, avatar_path, locale) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.schools   enable row level security;
alter table public.profiles  enable row level security;
alter table public.audit_log enable row level security;

create policy "schools: active accounts can read"
  on public.schools for select
  to authenticated
  using ((select public.current_app_role()) is not null);

create policy "profiles: read self, own school and staff; staff read all"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_staff())
    or (
      (select public.current_app_role()) is not null
      and deactivated_at is null
      and (school_id = (select public.current_school_id()) or role in ('staff', 'admin'))
    )
  );

create policy "profiles: update own active profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and deactivated_at is null)
  with check (id = (select auth.uid()));

create policy "audit log: admins can read"
  on public.audit_log for select
  to authenticated
  using ((select public.is_admin()));
