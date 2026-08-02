-- Exit interviews + AI-assisted root-cause analysis across an org's
-- accumulated interviews. Admin-only in both directions -- unlike
-- assessment_results or gap_analyses, an employee (current or departed)
-- never sees their own exit interview record; this is HR-internal data,
-- same posture as employee_manager_notes and performance_rating.
--
-- employee_user_id is nullable with ON DELETE SET NULL rather than
-- CASCADE: if the departed person's account is later deleted (the
-- existing self-serve data-deletion feature), the exit interview record
-- should survive as a historical HR record, not vanish with them --
-- employee_name is stored as a snapshot text field for exactly this
-- reason, not derived via a join that could go stale or disappear.
create table if not exists public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  department text,
  title text,
  manager_name text,
  last_day date,
  separation_type text not null default 'voluntary',
  responses jsonb not null default '[]'::jsonb,
  additional_notes text,
  conducted_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Append-only log rather than one-row-per-org upsert: each "Analyze
-- trends" run is its own record, so an admin can see how root causes and
-- flight-risk signals shifted over time, not just the latest snapshot.
create table if not exists public.exit_interview_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis jsonb not null,
  interview_count integer not null,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.exit_interviews enable row level security;
alter table public.exit_interview_analyses enable row level security;

drop policy if exists "Org admins can view exit interviews" on public.exit_interviews;
create policy "Org admins can view exit interviews"
  on public.exit_interviews for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can record exit interviews" on public.exit_interviews;
create policy "Org admins can record exit interviews"
  on public.exit_interviews for insert
  with check (public.is_org_admin(organization_id) and conducted_by = auth.uid());

drop policy if exists "Org admins can edit exit interviews" on public.exit_interviews;
create policy "Org admins can edit exit interviews"
  on public.exit_interviews for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can delete exit interviews" on public.exit_interviews;
create policy "Org admins can delete exit interviews"
  on public.exit_interviews for delete
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can view exit interview analyses" on public.exit_interview_analyses;
create policy "Org admins can view exit interview analyses"
  on public.exit_interview_analyses for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can generate exit interview analyses" on public.exit_interview_analyses;
create policy "Org admins can generate exit interview analyses"
  on public.exit_interview_analyses for insert
  with check (public.is_org_admin(organization_id) and generated_by = auth.uid());

create index if not exists exit_interviews_org_idx on public.exit_interviews (organization_id, created_at desc);
create index if not exists exit_interview_analyses_org_idx on public.exit_interview_analyses (organization_id, created_at desc);
