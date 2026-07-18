-- Two independent corporate additions:
-- 1) employee_id — an HR reference/badge number, free text, admin-editable
--    per member (same posture as manager_name/department: a free-text HR
--    field, not a structural identifier the app relies on for anything).
-- 2) seat_limit — a platform-admin-controlled max headcount per
--    organization, so Devometrics staff can assign how many seats a
--    company gets from the backend. Enforced at the RLS layer (the actual
--    boundary in this app, no service-role key), not just app-layer, so a
--    direct insert can't silently exceed it either.

alter table public.organization_members
  add column if not exists employee_id text;

alter table public.organizations
  add column if not exists seat_limit integer;

-- 0013 only ever gave platform admins READ access (profiles/gap_analyses/
-- assessment_results/development_plans/milestones) — this is the first
-- platform-admin WRITE grant, scoped narrowly to organizations, for exactly
-- one purpose (setting seat_limit from the backend).
drop policy if exists "Platform admins can update organizations" on public.organizations;
create policy "Platform admins can update organizations"
  on public.organizations for update
  using (public.is_admin())
  with check (public.is_admin());

-- null seat_limit = unlimited (the default for every existing org, so
-- nothing already-running breaks the moment this migrates).
create or replace function public.org_seat_limit_ok(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    (select seat_limit from public.organizations where id = target_org_id) is null
    or (select count(*) from public.organization_members where organization_id = target_org_id)
       < (select seat_limit from public.organizations where id = target_org_id);
$$;

-- Only the 'member' join path is seat-gated — the one-time 'admin' row an
-- org's creator gets when standing up their own workspace isn't a headcount
-- growth vector and shouldn't be blocked by a limit meant to cap employee
-- count.
drop policy if exists "Users can join an organization as themselves" on public.organization_members;
create policy "Users can join an organization as themselves"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      (role = 'admin' and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      ))
      or (role = 'member' and public.org_seat_limit_ok(organization_id))
    )
  );
