-- Phase 1 of the retention roadmap: two history-snapshot tables (so
-- Phase 2/3's trend-based signals -- Burnout Risk, Engagement Trend --
-- have real longitudinal data to work with months from now instead of
-- nothing) plus the Flight Risk Score v1 itself, which deliberately uses
-- only signals that are real and available TODAY (tenure, high-potential
-- status, succession coverage, current rating, learning/milestone
-- progress, survey participation, manager-notes content, department/
-- manager attrition from exit interviews) -- explicitly not a
-- performance "trend" or "promotion wait time", since no historical data
-- exists for those yet. All three tables are admin-only in both
-- directions, same posture as performance_rating/employee_manager_notes/
-- exit_interviews -- this is HR-internal signal data, an employee never
-- sees their own flight-risk record.

create table if not exists public.employee_performance_rating_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  note text not null default '',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Generic field-change log rather than a manager-specific table: `field`
-- lets this cover title/department changes too if an editable path for
-- those is ever added, without a schema change. Only 'manager' is
-- populated today (see lib/orgChart/actions.ts's setMemberManager).
create table if not exists public.employee_role_change_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Append-only, same reasoning as exit_interview_analyses (0098): each
-- computation is its own row, so an admin can see how someone's flight
-- risk shifted over repeated runs, not just the latest snapshot.
create table if not exists public.employee_flight_risk_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  contributing_factors jsonb not null default '[]'::jsonb,
  suggested_actions jsonb not null default '[]'::jsonb,
  signals_used jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.employee_performance_rating_history enable row level security;
alter table public.employee_role_change_history enable row level security;
alter table public.employee_flight_risk_scores enable row level security;

drop policy if exists "Org admins can view performance rating history" on public.employee_performance_rating_history;
create policy "Org admins can view performance rating history"
  on public.employee_performance_rating_history for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can record performance rating history" on public.employee_performance_rating_history;
create policy "Org admins can record performance rating history"
  on public.employee_performance_rating_history for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can view role change history" on public.employee_role_change_history;
create policy "Org admins can view role change history"
  on public.employee_role_change_history for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can record role change history" on public.employee_role_change_history;
create policy "Org admins can record role change history"
  on public.employee_role_change_history for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can view flight risk scores" on public.employee_flight_risk_scores;
create policy "Org admins can view flight risk scores"
  on public.employee_flight_risk_scores for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can generate flight risk scores" on public.employee_flight_risk_scores;
create policy "Org admins can generate flight risk scores"
  on public.employee_flight_risk_scores for insert
  with check (public.is_org_admin(organization_id) and generated_by = auth.uid());

create index if not exists employee_performance_rating_history_employee_idx on public.employee_performance_rating_history (employee_user_id, created_at desc);
create index if not exists employee_role_change_history_employee_idx on public.employee_role_change_history (employee_user_id, created_at desc);
create index if not exists employee_flight_risk_scores_employee_idx on public.employee_flight_risk_scores (organization_id, employee_user_id, created_at desc);
