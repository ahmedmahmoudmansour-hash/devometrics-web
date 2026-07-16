-- Job Architecture — the structural spine the talent features have been
-- missing. This is what SAP calls "Job Architecture" and Oracle calls "Job
-- Families + Grades": a company defines its functional families, the roles
-- within each, the grade/level of every role, the competency profile a role
-- requires, and the vertical/horizontal moves between roles. Everything
-- already built (gap analysis, 9-box, HiPo, succession) becomes sharper once
-- a person is placed in a real role with a real required-competency profile,
-- because "development needed" stops being a guess and becomes
-- (role requirement − measured level) per dimension.
--
-- Deliberately NOT tied to any licensed grading methodology (Korn Ferry Hay
-- points, Mercer IPE) — same honest stance as the Big Five work avoiding
-- trademarked instruments. Grade is a plain 1–10 band each company shapes
-- to its own structure; the LOGIC mirrors those frameworks (grade rises with
-- scope/impact/complexity) without claiming to BE them.

-- A functional grouping: Engineering, Sales, Finance, People, etc.
create table if not exists public.job_families (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- A specific role within a family, at a grade and level. `track` separates
-- the individual-contributor ladder from the management ladder — the two
-- parallel spines every real job architecture has. `grade` (1–10) is the
-- comparable band that makes "vertical" (grade up) vs "horizontal" (same
-- grade, different family) a structural fact rather than a label.
create table if not exists public.job_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_family_id uuid not null references public.job_families(id) on delete cascade,
  title text not null,
  -- Free-text ladder label the company already uses, e.g. "IC3", "M2",
  -- "Senior", "Principal" — display only; `grade` is the sortable spine.
  level text not null default '',
  grade int not null default 1 check (grade between 1 and 10),
  track text not null default 'ic' check (track in ('ic', 'management')),
  responsibilities text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The bridge to the existing competency engine: the target level (0–100) a
-- role requires on each of the 8 fixed dimensions. A person's development
-- need for a role is (this − their measured level), dimension by dimension.
create table if not exists public.role_competency_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.job_roles(id) on delete cascade,
  dimension text not null,
  target_level int not null default 0 check (target_level between 0 and 100),
  unique (role_id, dimension)
);

-- The explicit career lattice: a directed edge between two roles, typed as a
-- promotion (vertical) or a lateral move (horizontal). The "untapped areas"
-- engine (later) will additionally infer *implicit* adjacencies from
-- competency distance, but these are the paths the company has deliberately
-- endorsed.
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

-- Places an employee in the architecture. Nullable and ON DELETE SET NULL so
-- deleting a role never deletes a person — they just become "unplaced" again.
-- Additive column; every existing query against organization_members is
-- unaffected, same safe pattern as the HR fields added in migration 0049.
alter table public.organization_members
  add column if not exists current_role_id uuid references public.job_roles(id) on delete set null;

alter table public.job_families enable row level security;
alter table public.job_roles enable row level security;
alter table public.role_competency_requirements enable row level security;
alter table public.role_transitions enable row level security;

-- Admin-managed for now (this migration ships the admin authoring side). When
-- the employee-facing mobility view lands, a member-SELECT policy gets added
-- so people can see their own role's paths and development needs — kept out
-- of this migration deliberately to keep the first slice tight and its access
-- surface obvious.
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
