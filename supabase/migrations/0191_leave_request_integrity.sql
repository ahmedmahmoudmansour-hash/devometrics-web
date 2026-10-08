-- 0191 -- Leave request integrity (pre-rollout audit 2026-10-08, CONFIRMED live
-- with test accounts, not inferred).
--
-- The "Employees edit or cancel their own pending/approved leave" UPDATE
-- policy (0166/0177) limits which STATUS a row may end up in, but RLS cannot
-- limit which COLUMNS an UPDATE touches. CONFIRMED: an employee could write
-- decided_by, decision_comment and decided_at on their own request -- e.g.
-- "Pre-approved by HR" signed with an admin's id -- and could flip a request
-- that HR had REJECTED back to pending, leaving the old decision text on it.
-- Also, nothing tied days_requested to the dates: a 31-day range could be
-- stored as 1 day, or a single day as 999.
--
-- Fix, in the same shape 0181 used for employee_profiles ("RLS cannot limit
-- which columns an UPDATE touches"):
--   1. Column-level privileges: authenticated may UPDATE only the fields a
--      requester legitimately edits. The decision/override columns can then
--      only be written by decide_leave_request / override_leave_decision
--      (SECURITY DEFINER, run as the owner, unaffected by this revoke).
--   2. The update policy no longer matches rejected or cancelled rows -- a
--      decision is final; the employee files a new request instead.
--   3. days_requested can't exceed the date range (end - start + 1). Added NOT
--      VALID so existing rows are not re-checked; every new/changed row is.
--      Understating days can't be caught without a work-week/holiday
--      calendar, so approvers still see the dates next to the day count.
--
-- Not changed on purpose: no balance check -- HR may legitimately approve
-- beyond a balance (unpaid extension, advance); the UI shows the balance.
--
-- App impact checked: the only direct employee-side write the app makes is
-- lib/leave/actions.ts `update({ status: "cancelled" })`; HR actions go
-- through the two RPCs or INSERT (insert privilege is untouched).

revoke update on public.leave_requests from authenticated;
grant update (leave_type_id, start_date, end_date, days_requested, status, reason) on public.leave_requests to authenticated;

drop policy if exists "Employees edit or cancel their own pending/approved leave" on public.leave_requests;
create policy "Employees edit or cancel their own pending/approved leave"
  on public.leave_requests for update
  using (employee_user_id = auth.uid() and status in ('pending', 'approved'))
  with check (
    employee_user_id = auth.uid()
    and status in ('pending', 'cancelled')
    and public.is_org_member(organization_id)
    and (status = 'cancelled' or public.can_request_leave_type(leave_type_id, employee_user_id))
  );

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'leave_requests'
      and constraint_name = 'leave_requests_days_within_range'
  ) then
    alter table public.leave_requests
      add constraint leave_requests_days_within_range
      check (days_requested <= (end_date - start_date) + 1) not valid;
  end if;
end $$;
