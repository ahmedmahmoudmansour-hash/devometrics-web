-- Two fixes from an expert review pass over the leave + compensation
-- decision workflows:
--
-- 1. Self-approval conflict of interest, found in BOTH decide_leave_
--    request (0166) and decide_compensation_proposal (0155/0160/0165).
--    Both authorize on "is_org_admin(org) OR is_manager_of_user(employee)"
--    — neither excludes the case where the employee on the request IS the
--    admin deciding it. is_manager_of_user can never be true for a
--    self-request (organization_members_manager_not_self, 0072, already
--    prevents anyone from being their own manager), so the only real path
--    was an admin/Comp-Admin approving their own leave/comp change.
--
--    Fix is deliberately NOT a blanket block — a solo-admin company (or
--    the only Compensation Admin) would otherwise have literally no way
--    to ever decide their own request. Self-decision is blocked ONLY when
--    another eligible decider actually exists (another org admin for
--    leave, another Compensation Admin for comp) — the same "only when a
--    real alternative exists" shape as setMemberRole's existing
--    "can't demote the last admin" guard (lib/organizations/actions.ts).
--
-- 2. leave_decision_overrides — override_leave_decision (0167) only kept
--    the MOST RECENT override visible on leave_requests itself; a second
--    override of the same request silently lost the first one. This adds
--    an append-only history table logging every override event, while
--    leave_requests.overridden_at/by/reason (0167) stays as-is for "the
--    latest override at a glance" without a join.
--
-- Depends on 0166 (leave_requests, decide_leave_request), 0167
-- (override_leave_decision, organizations), 0156 (organization_
-- compensation_admins), 0160/0165 (decide_compensation_proposal).

create table if not exists public.leave_decision_overrides (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.leave_requests (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  previous_status text not null,
  new_status text not null,
  overridden_by uuid not null references auth.users (id),
  reason text,
  overridden_at timestamptz not null default now()
);

alter table public.leave_decision_overrides enable row level security;

-- Org-admin only, same as who can override in the first place — no
-- INSERT policy for authenticated at all, every row is written by
-- override_leave_decision() running as its own SECURITY DEFINER owner.
drop policy if exists "Org admins view leave override history" on public.leave_decision_overrides;
create policy "Org admins view leave override history"
  on public.leave_decision_overrides for select
  using (public.is_org_admin(organization_id));

create index if not exists leave_decision_overrides_request_idx on public.leave_decision_overrides (request_id, overridden_at desc);

create or replace function public.decide_leave_request(p_request_id uuid, p_decision text, p_comment text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.leave_requests%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into v_req from public.leave_requests where id = p_request_id limit 1;
  if v_req.id is null then
    raise exception 'Not found';
  end if;
  if not (public.is_org_admin(v_req.organization_id) or public.is_manager_of_user(v_req.employee_user_id)) then
    raise exception 'Not authorized';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been decided';
  end if;

  if v_req.employee_user_id = auth.uid() and exists (
    select 1 from public.organization_members
    where organization_id = v_req.organization_id and role = 'admin' and user_id <> auth.uid()
  ) then
    raise exception 'You cannot decide your own leave request while another admin is available — ask them instead';
  end if;

  update public.leave_requests
  set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_comment = p_comment
  where id = p_request_id;

  return true;
end;
$$;

create or replace function public.override_leave_decision(p_request_id uuid, p_decision text, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.leave_requests%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into v_req from public.leave_requests where id = p_request_id limit 1;
  if v_req.id is null then
    raise exception 'Not found';
  end if;
  if not public.is_org_admin(v_req.organization_id) then
    raise exception 'Not authorized';
  end if;
  if v_req.status not in ('approved', 'rejected') then
    raise exception 'Only an already-decided request can be overridden';
  end if;
  if v_req.status = p_decision then
    raise exception 'Already set to this decision';
  end if;

  if v_req.employee_user_id = auth.uid() and exists (
    select 1 from public.organization_members
    where organization_id = v_req.organization_id and role = 'admin' and user_id <> auth.uid()
  ) then
    raise exception 'You cannot override your own leave request while another admin is available — ask them instead';
  end if;

  insert into public.leave_decision_overrides (request_id, organization_id, previous_status, new_status, overridden_by, reason)
  values (p_request_id, v_req.organization_id, v_req.status, p_decision, auth.uid(), p_reason);

  update public.leave_requests
  set status = p_decision, overridden_at = now(), overridden_by = auth.uid(), override_reason = p_reason
  where id = p_request_id;

  return true;
end;
$$;

-- decide_compensation_proposal — same self-approval guard, checked against
-- organization_compensation_admins instead of organization_members.role.
-- Signature/return type unchanged from 0165; every other line identical.
create or replace function public.decide_compensation_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_comment text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.compensation_proposals%rowtype;
  v_change_id uuid;
  v_old_record public.compensation_records%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into v_proposal from public.compensation_proposals where id = p_proposal_id limit 1;
  if v_proposal.id is null then
    raise exception 'Not found';
  end if;
  if not public.has_compensation_access(v_proposal.organization_id) then
    raise exception 'Not authorized';
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'This proposal has already been decided';
  end if;

  if v_proposal.employee_user_id = auth.uid() and exists (
    select 1 from public.organization_compensation_admins
    where organization_id = v_proposal.organization_id and user_id <> auth.uid()
  ) then
    raise exception 'You cannot decide your own compensation proposal while another Compensation Admin is available — ask them instead';
  end if;

  insert into public.compensation_approvals (proposal_id, approver_user_id, decision, comment)
  values (p_proposal_id, auth.uid(), p_decision, p_comment);

  update public.compensation_proposals
  set status = p_decision, decided_at = now(), decided_by = auth.uid()
  where id = p_proposal_id;

  if p_decision = 'approved' then
    select * into v_old_record
    from public.compensation_records
    where employee_user_id = v_proposal.employee_user_id and organization_id = v_proposal.organization_id and effective_to is null
    limit 1;

    insert into public.compensation_changes (
      organization_id, employee_user_id, proposal_id, old_amount, new_amount,
      old_salary_band_id, new_salary_band_id, effective_date, applied_by
    ) values (
      v_proposal.organization_id, v_proposal.employee_user_id, p_proposal_id,
      v_old_record.amount, v_proposal.proposed_amount,
      v_old_record.salary_band_id, v_proposal.proposed_salary_band_id,
      v_proposal.proposed_effective_date, auth.uid()
    )
    returning id into v_change_id;

    if v_old_record.id is not null then
      update public.compensation_records
      set effective_to = v_proposal.proposed_effective_date - interval '1 day'
      where id = v_old_record.id;
    end if;

    insert into public.compensation_records (
      organization_id, employee_user_id, salary_band_id, amount, currency,
      pay_frequency, effective_from, effective_to, change_reason, source_change_id, created_by,
      monthly_deduction_amount, deduction_note
    ) values (
      v_proposal.organization_id, v_proposal.employee_user_id, v_proposal.proposed_salary_band_id,
      v_proposal.proposed_amount, v_proposal.proposed_currency,
      coalesce(v_old_record.pay_frequency, 'annual'), v_proposal.proposed_effective_date, null,
      v_proposal.reason, v_change_id, auth.uid(),
      v_proposal.proposed_monthly_deduction_amount, v_proposal.proposed_deduction_note
    );
  end if;

  return true;
end;
$$;
