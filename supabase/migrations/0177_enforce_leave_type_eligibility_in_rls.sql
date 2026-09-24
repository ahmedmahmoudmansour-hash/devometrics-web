-- 0174 added leave type eligibility, but only the UI honored it
-- (listMyEligibleLeaveTypes filters the dropdown). Found via live testing
-- 2026-09-24: an employee NOT on a restricted type's grant list could still
-- POST a leave request for it straight to the REST API and get a 201 -- the
-- leave_requests INSERT policy only ever checked "is this my own row" and
-- org membership, never the leave type. RLS, not the UI, is this app's real
-- boundary (same class of gap 0173 closed for employment_status).
--
-- Fix: a small SECURITY DEFINER helper (plain `select exists`, so it can
-- never throw inside a policy) and one extra condition on the employee-
-- facing branches of the leave_requests INSERT/UPDATE policies. The org-
-- admin branch is deliberately untouched: HR can still record leave for
-- anyone, including outside a type's eligibility list (e.g. a one-off
-- exception), which is a legitimate override, not a bypass.
--
-- UPDATE: cancelling is always allowed (someone whose eligibility was
-- revoked after they booked must still be able to withdraw the request);
-- any other edit must still satisfy eligibility, so a pending request can't
-- be re-pointed at a restricted type after the fact.

create or replace function public.can_request_leave_type(p_leave_type_id uuid, p_employee_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.leave_types lt
    where lt.id = p_leave_type_id
      and (
        lt.eligibility <> 'restricted'
        or exists (
          select 1 from public.leave_type_eligibility e
          where e.leave_type_id = lt.id and e.employee_user_id = p_employee_user_id
        )
      )
  );
$$;

revoke all on function public.can_request_leave_type(uuid, uuid) from public;
grant execute on function public.can_request_leave_type(uuid, uuid) to authenticated;

drop policy if exists "Employees request their own leave" on public.leave_requests;
create policy "Employees request their own leave"
  on public.leave_requests for insert
  with check (
    (
      employee_user_id = auth.uid()
      and status = 'pending'
      and public.is_org_member(organization_id)
      and public.can_request_leave_type(leave_type_id, employee_user_id)
    )
    or public.is_org_admin(organization_id)
  );

drop policy if exists "Employees edit or cancel their own pending/approved leave" on public.leave_requests;
create policy "Employees edit or cancel their own pending/approved leave"
  on public.leave_requests for update
  using (employee_user_id = auth.uid())
  with check (
    employee_user_id = auth.uid()
    and status in ('pending', 'cancelled')
    and public.is_org_member(organization_id)
    and (status = 'cancelled' or public.can_request_leave_type(leave_type_id, employee_user_id))
  );
