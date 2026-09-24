-- 0173: Close a real gap found via live testing of 0172
--
-- 0172 gated org-wide access through is_org_member/is_org_admin, which
-- every SELECT policy on leave_requests/hr_letter_requests already routed
-- through (or, for leave_requests specifically, hit directly via
-- employee_user_id = auth.uid() reads that RLS still resolves through the
-- table's own SELECT policy). But the self-service INSERT/UPDATE policies
-- on both tables check ONLY "is this my own row" (employee_user_id =
-- auth.uid()) -- they never called is_org_member at all. Verified live: a
-- resigned test employee could no longer READ leave types/balances/their
-- own history (correctly blocked), but could still POST a brand new
-- pending leave_requests row directly via the REST API, bypassing the
-- app's own UI (which never gets that far since it can't load leave types
-- to populate the form -- but the raw endpoint had no such gate).
--
-- Fix: add is_org_member(organization_id) to the self-service branch of
-- each policy below. The admin branch (is_org_admin(organization_id)) is
-- untouched -- it already transitively requires an active admin as of
-- 0172, so no separate change is needed there.

drop policy if exists "Employees request their own leave" on public.leave_requests;
create policy "Employees request their own leave"
  on public.leave_requests for insert
  with check (
    (employee_user_id = auth.uid() and status = 'pending' and public.is_org_member(organization_id))
    or public.is_org_admin(organization_id)
  );

drop policy if exists "Employees edit or cancel their own pending/approved leave" on public.leave_requests;
create policy "Employees edit or cancel their own pending/approved leave"
  on public.leave_requests for update
  using (employee_user_id = auth.uid())
  with check (employee_user_id = auth.uid() and status in ('pending', 'cancelled') and public.is_org_member(organization_id));

drop policy if exists "Employees request their own hr letters" on public.hr_letter_requests;
create policy "Employees request their own hr letters"
  on public.hr_letter_requests for insert
  with check (
    (employee_user_id = auth.uid() and requested_by = auth.uid() and status = 'pending' and public.is_org_member(organization_id))
    or public.is_org_admin(organization_id)
  );
