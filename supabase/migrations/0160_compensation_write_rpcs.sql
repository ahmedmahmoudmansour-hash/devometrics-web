-- Compensation Management, part 7/7: write RPCs. Highest blast radius in
-- this batch, reviewed last, once the read side (0159) is settled.
-- Depends on 0155 (workflow tables), 0157 (access helpers), 0158
-- (audit logging — write-side is also covered by the AFTER triggers
-- added there, so these functions don't need to call
-- record_compensation_audit_event() themselves for the propose/approve/
-- reject actions; the trigger on each insert handles it).

-- A manager proposes a change for one of their own direct reports, or a
-- Compensation Admin proposes one for anyone in the org. Never writes
-- compensation_records directly — only ever compensation_proposals.
create or replace function public.propose_compensation_change(
  p_organization_id uuid,
  p_employee_user_id uuid,
  p_proposed_amount numeric,
  p_proposed_currency text,
  p_proposed_salary_band_id uuid,
  p_proposed_effective_date date,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (public.is_manager_of_user(p_employee_user_id) or public.has_compensation_access(p_organization_id)) then
    raise exception 'Not authorized';
  end if;
  if p_proposed_amount < 0 then
    raise exception 'Amount must be non-negative';
  end if;

  insert into public.compensation_proposals (
    organization_id, employee_user_id, proposed_by, proposed_amount, proposed_currency,
    proposed_salary_band_id, proposed_effective_date, reason
  ) values (
    p_organization_id, p_employee_user_id, auth.uid(), p_proposed_amount, coalesce(p_proposed_currency, 'USD'),
    p_proposed_salary_band_id, p_proposed_effective_date, p_reason
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.propose_compensation_change(uuid, uuid, numeric, text, uuid, date, text) from public;
grant execute on function public.propose_compensation_change(uuid, uuid, numeric, text, uuid, date, text) to authenticated;

-- Compensation Admin decides a pending proposal. On 'approved': writes
-- compensation_approvals + compensation_changes, closes the employee's
-- current compensation_records row (effective_to), and opens a new one —
-- all in this one function, so it's atomic (a Postgres function body is
-- one transaction). On 'rejected': just records the decision and updates
-- proposal status; no compensation_records/changes writes at all.
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
      pay_frequency, effective_from, effective_to, change_reason, source_change_id, created_by
    ) values (
      v_proposal.organization_id, v_proposal.employee_user_id, v_proposal.proposed_salary_band_id,
      v_proposal.proposed_amount, v_proposal.proposed_currency,
      coalesce(v_old_record.pay_frequency, 'annual'), v_proposal.proposed_effective_date, null,
      v_proposal.reason, v_change_id, auth.uid()
    );
  end if;

  return true;
end;
$$;

revoke all on function public.decide_compensation_proposal(uuid, text, text) from public;
grant execute on function public.decide_compensation_proposal(uuid, text, text) to authenticated;

-- Lets the original proposer (or a Compensation Admin) cancel their own
-- still-pending proposal. The 'withdrawn' status was in the check
-- constraint from the start (0155) but nothing ever set it — without this,
-- a manager who mis-typed an amount had no way to cancel it themselves,
-- only a Comp Admin rejecting it closed the loop. Logged as 'withdraw' via
-- the write trigger (0158), not a generic 'edit'.
create or replace function public.withdraw_compensation_proposal(p_proposal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.compensation_proposals%rowtype;
begin
  select * into v_proposal from public.compensation_proposals where id = p_proposal_id limit 1;
  if v_proposal.id is null then
    raise exception 'Not found';
  end if;
  if v_proposal.proposed_by <> auth.uid() and not public.has_compensation_access(v_proposal.organization_id) then
    raise exception 'Not authorized';
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'This proposal has already been decided';
  end if;

  update public.compensation_proposals set status = 'withdrawn' where id = p_proposal_id;
  return true;
end;
$$;

revoke all on function public.withdraw_compensation_proposal(uuid) from public;
grant execute on function public.withdraw_compensation_proposal(uuid) to authenticated;
