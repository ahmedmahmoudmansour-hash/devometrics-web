-- Real, trackable assessment assignment — previously the only way to
-- "assign an assessment" was typing it as a free-text task title, which
-- didn't link to the real assessment or track whether it was actually
-- completed. This is a genuine assignment: admin picks from the real
-- catalog, the employee sees it as "assigned to you" in their own
-- Assessment Center, and completion is read directly from
-- assessment_results at query time rather than a separately-tracked flag
-- that could drift out of sync with what actually happened.
--
-- Same is_org_admin_of_user() scoping as milestone assignment (0031) — an
-- admin can only assign to members of their own organization.
create table if not exists public.assigned_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  assessment_slug text not null,
  assigned_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_user_id, assessment_slug)
);

alter table public.assigned_assessments enable row level security;

drop policy if exists "Org admins can assign assessments to their members" on public.assigned_assessments;
create policy "Org admins can assign assessments to their members"
  on public.assigned_assessments for insert
  with check (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Org admins can view assignments for their members" on public.assigned_assessments;
create policy "Org admins can view assignments for their members"
  on public.assigned_assessments for select
  using (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Org admins can remove assignments for their members" on public.assigned_assessments;
create policy "Org admins can remove assignments for their members"
  on public.assigned_assessments for delete
  using (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Employees can view their own assigned assessments" on public.assigned_assessments;
create policy "Employees can view their own assigned assessments"
  on public.assigned_assessments for select
  using (employee_user_id = auth.uid());

create index if not exists assigned_assessments_employee_idx on public.assigned_assessments (employee_user_id);
