-- ============================================================
-- DEVOMETRICS — ALL PENDING MIGRATIONS IN ONE PASTE
-- Combines 0066 + 0067 + 0068 + 0069 + 0070 + 0071. Every statement is
-- idempotent (IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS / a
-- catalog-lookup DO block instead of a guessed constraint name), so
-- running this more than once, or after part of it already ran, is safe.
-- Order matters within this file (0069 depends on 0066's status column
-- already existing) — paste and run the whole thing as one block.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run.
-- ============================================================

-- ============================================================
-- 0066: Milestone status (in_progress/completed/deferred) +
-- admin-triggered employee data deletion
-- ============================================================

alter table public.milestones
  add column if not exists status text not null default 'in_progress'
  check (status in ('in_progress', 'completed', 'deferred'));

update public.milestones set status = 'completed' where completed = true and status = 'in_progress';

create or replace function public.admin_schedule_employee_data_deletion(employee_id uuid, grace_days int default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  deletion_at timestamptz;
begin
  if not public.is_org_admin_of_user(employee_id) then
    raise exception 'Not authorized';
  end if;

  deletion_at := now() + (grace_days || ' days')::interval;
  update public.profiles set pending_data_deletion_at = deletion_at where id = employee_id;

  return deletion_at;
end;
$$;

revoke all on function public.admin_schedule_employee_data_deletion(uuid, int) from public;
grant execute on function public.admin_schedule_employee_data_deletion(uuid, int) to authenticated;

create or replace function public.admin_cancel_employee_data_deletion(employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin_of_user(employee_id) then
    raise exception 'Not authorized';
  end if;

  update public.profiles set pending_data_deletion_at = null where id = employee_id;
end;
$$;

revoke all on function public.admin_cancel_employee_data_deletion(uuid) from public;
grant execute on function public.admin_cancel_employee_data_deletion(uuid) to authenticated;

-- ============================================================
-- 0067: Job Architecture — families, graded roles, competency
-- requirements, career paths
-- ============================================================

create table if not exists public.job_families (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.job_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_family_id uuid not null references public.job_families(id) on delete cascade,
  title text not null,
  level text not null default '',
  grade int not null default 1 check (grade between 1 and 10),
  track text not null default 'ic' check (track in ('ic', 'management')),
  responsibilities text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.role_competency_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.job_roles(id) on delete cascade,
  dimension text not null,
  target_level int not null default 0 check (target_level between 0 and 100),
  unique (role_id, dimension)
);

create table if not exists public.role_transitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_role_id uuid not null references public.job_roles(id) on delete cascade,
  to_role_id uuid not null references public.job_roles(id) on delete cascade,
  transition_type text not null check (transition_type in ('vertical', 'horizontal')),
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (from_role_id, to_role_id)
);

alter table public.organization_members
  add column if not exists current_role_id uuid references public.job_roles(id) on delete set null;

alter table public.job_families enable row level security;
alter table public.job_roles enable row level security;
alter table public.role_competency_requirements enable row level security;
alter table public.role_transitions enable row level security;

drop policy if exists "Org admins manage job families" on public.job_families;
create policy "Org admins manage job families"
  on public.job_families for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage job roles" on public.job_roles;
create policy "Org admins manage job roles"
  on public.job_roles for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage role requirements" on public.role_competency_requirements;
create policy "Org admins manage role requirements"
  on public.role_competency_requirements for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage role transitions" on public.role_transitions;
create policy "Org admins manage role transitions"
  on public.role_transitions for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists job_families_org_idx on public.job_families (organization_id, name);
create index if not exists job_roles_org_idx on public.job_roles (organization_id, grade);
create index if not exists job_roles_family_idx on public.job_roles (job_family_id);
create index if not exists role_requirements_role_idx on public.role_competency_requirements (role_id);
create index if not exists role_transitions_from_idx on public.role_transitions (from_role_id);

-- ============================================================
-- 0068: Performance rating + manager notes (both optional,
-- direct management input, never AI-inferred)
-- ============================================================

alter table public.organization_members
  add column if not exists performance_rating int check (performance_rating between 1 and 5),
  add column if not exists performance_rating_note text not null default '',
  add column if not exists performance_rating_updated_at timestamptz;

create table if not exists public.employee_manager_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.employee_manager_notes enable row level security;

drop policy if exists "Org admins manage manager notes" on public.employee_manager_notes;
create policy "Org admins manage manager notes"
  on public.employee_manager_notes for all
  using (public.is_org_admin_of_user(employee_user_id))
  with check (public.is_org_admin_of_user(employee_user_id));

create index if not exists employee_manager_notes_employee_idx on public.employee_manager_notes (employee_user_id, created_at desc);

-- ============================================================
-- 0069: "Not started" milestone status (requires 0066 above to
-- have already run in this same batch)
-- ============================================================

do $$
declare
  existing_constraint text;
begin
  select tc.constraint_name into existing_constraint
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
    and ccu.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'milestones'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'status'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.milestones drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.milestones
  alter column status set default 'not_started';

alter table public.milestones
  add constraint milestones_status_check
  check (status in ('not_started', 'in_progress', 'completed', 'deferred'));

-- ============================================================
-- 0070: Company Scorecard — Customer/Process/Financial manual
-- KPIs (Learning & Growth is computed live, no table needed)
-- ============================================================

create table if not exists public.scorecard_kpis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  perspective text not null check (perspective in ('customer', 'process', 'financial')),
  name text not null,
  target text not null default '',
  actual text not null default '',
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'off_track')),
  note text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scorecard_kpis enable row level security;

drop policy if exists "Org admins manage scorecard KPIs" on public.scorecard_kpis;
create policy "Org admins manage scorecard KPIs"
  on public.scorecard_kpis for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists scorecard_kpis_org_idx on public.scorecard_kpis (organization_id, perspective, created_at desc);

-- ============================================================
-- 0071: Bug fix — infinite recursion in surveys RLS
-- (pre-existing, from migration 0041, unrelated to new features
-- but bundled here since it was found during this same pass)
-- ============================================================

create or replace function public.is_assigned_to_survey(check_survey_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.survey_assignments sa
    where sa.survey_id = check_survey_id and sa.employee_user_id = auth.uid()
  )
$$;

revoke all on function public.is_assigned_to_survey(uuid) from public;
grant execute on function public.is_assigned_to_survey(uuid) to anon, authenticated;

drop policy if exists "Assigned employees can view their surveys" on public.surveys;
create policy "Assigned employees can view their surveys"
  on public.surveys for select
  using (public.is_assigned_to_survey(id));

drop policy if exists "Org admins manage assignments for their surveys" on public.survey_assignments;
create policy "Org admins manage assignments for their surveys"
  on public.survey_assignments for all
  using (public.is_org_admin_of_user(employee_user_id))
  with check (public.is_org_admin_of_user(employee_user_id));

-- ============================================================
-- End of batch. All 6 migrations applied.
-- ============================================================
