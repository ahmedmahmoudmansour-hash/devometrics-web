-- Adds an optional, manually-entered "monthly deduction" reference field —
-- purely informational, never calculated, never affecting `amount` or any
-- other figure. This is deliberately NOT a payroll/tax engine: no
-- jurisdiction rules, no statutory tables, no net-pay math. It exists so an
-- org can note something like "~150 USD/mo for health + pension" next to a
-- record, the same spirit as `change_reason` — free text plus an optional
-- number, recorded by a human, not computed by Devometrics. Keeps the
-- "Internal Compensation Record — Not a Statutory Payslip" framing intact.
--
-- Customizable at two levels, per the request that prompted this:
--   - salary_bands.default_monthly_deduction_amount/default_deduction_note
--     — an optional per-band template an admin sets once (e.g. "L4_ENG
--     typically deducts ~150/mo") — reference only, never auto-applied.
--   - compensation_records/compensation_proposals' own
--     monthly_deduction_amount/deduction_note — the actual per-employee
--     value, entered independently when proposing or recording a change.
--
-- Depends on 0154 (salary_bands, compensation_records), 0155
-- (compensation_proposals), 0159/0160 (every RPC touching these columns,
-- all redefined below to surface them).

alter table public.salary_bands
  add column if not exists default_monthly_deduction_amount numeric(14,2),
  add column if not exists default_deduction_note text;

alter table public.compensation_records
  add column if not exists monthly_deduction_amount numeric(14,2),
  add column if not exists deduction_note text;

alter table public.compensation_proposals
  add column if not exists proposed_monthly_deduction_amount numeric(14,2),
  add column if not exists proposed_deduction_note text;

-- ============================================================
-- Read RPCs — each needs drop + recreate since their RETURNS TABLE shape
-- is widening (Postgres refuses to CREATE OR REPLACE a function whose
-- return type changed). Deduction fields follow the exact same exact/band/
-- none redaction as `amount` itself wherever that redaction already
-- applies — deduction figures are financial detail, not less sensitive
-- than the amount they sit next to.
-- ============================================================

drop function if exists public.get_my_compensation();
create or replace function public.get_my_compensation()
returns table (
  id uuid, salary_band_id uuid, amount numeric, currency text, pay_frequency text,
  effective_from date, effective_to date, change_reason text, created_at timestamptz,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.record_compensation_audit_event(
    (select organization_id from public.compensation_records where employee_user_id = auth.uid() and effective_to is null limit 1),
    'view', array[auth.uid()]::uuid[], null, 'get_my_compensation'
  );

  return query
    select r.id, r.salary_band_id, r.amount, r.currency, r.pay_frequency,
           r.effective_from, r.effective_to, r.change_reason, r.created_at,
           r.monthly_deduction_amount, r.deduction_note
    from public.compensation_records r
    where r.employee_user_id = auth.uid()
    order by r.effective_from desc;
exception when others then
  return;
end;
$$;

revoke all on function public.get_my_compensation() from public;
grant execute on function public.get_my_compensation() to authenticated;

drop function if exists public.get_compensation_record(uuid);
create or replace function public.get_compensation_record(p_record_id uuid)
returns table (
  id uuid, organization_id uuid, employee_user_id uuid, salary_band_id uuid,
  amount numeric, currency text, pay_frequency text,
  effective_from date, effective_to date, change_reason text, created_at timestamptz,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_row public.compensation_records%rowtype;
  v_visibility text;
  v_can_see_exact boolean;
begin
  select * into v_row from public.compensation_records where id = p_record_id limit 1;
  if v_row.id is null then
    raise exception 'Not found';
  end if;

  if v_row.employee_user_id = auth.uid() then
    v_can_see_exact := true; -- self, always allowed
  elsif public.has_compensation_access(v_row.organization_id) then
    v_can_see_exact := true; -- Comp Admin, org-wide
  else
    v_visibility := public.manager_compensation_visibility(v_row.employee_user_id);
    if v_visibility not in ('exact', 'band') then
      raise exception 'Not authorized';
    end if;
    v_can_see_exact := v_visibility = 'exact';
  end if;

  perform public.record_compensation_audit_event(
    v_row.organization_id, 'view', array[v_row.employee_user_id]::uuid[], v_row.id, 'get_compensation_record'
  );

  return query
    select v_row.id, v_row.organization_id, v_row.employee_user_id, v_row.salary_band_id,
           -- band-only visibility never returns the exact figure, even for a single-record lookup
           case when v_can_see_exact then v_row.amount else null end,
           v_row.currency, v_row.pay_frequency, v_row.effective_from, v_row.effective_to, v_row.change_reason, v_row.created_at,
           case when v_can_see_exact then v_row.monthly_deduction_amount else null end,
           case when v_can_see_exact then v_row.deduction_note else null end;
end;
$$;

revoke all on function public.get_compensation_record(uuid) from public;
grant execute on function public.get_compensation_record(uuid) to authenticated;

drop function if exists public.list_team_compensation(uuid);
create or replace function public.list_team_compensation(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date, visibility text,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_subjects uuid[];
begin
  if not public.is_org_member(p_organization_id) then
    return;
  end if;

  select coalesce(array_agg(r.employee_user_id), '{}') into v_subjects
  from public.compensation_records r
  join public.organization_members m on m.user_id = r.employee_user_id and m.organization_id = p_organization_id
  where r.effective_to is null
    and m.manager_user_id = auth.uid()
    and public.manager_compensation_visibility(r.employee_user_id) in ('exact', 'band');

  perform public.record_compensation_audit_event(
    p_organization_id, 'view_batch', v_subjects, null, format('list_team_compensation (%s reports)', array_length(v_subjects, 1))
  );

  return query
    select r.employee_user_id, r.salary_band_id,
           case when public.manager_compensation_visibility(r.employee_user_id) = 'exact' then r.amount else null end,
           r.currency, r.pay_frequency, r.effective_from,
           public.manager_compensation_visibility(r.employee_user_id),
           case when public.manager_compensation_visibility(r.employee_user_id) = 'exact' then r.monthly_deduction_amount else null end,
           case when public.manager_compensation_visibility(r.employee_user_id) = 'exact' then r.deduction_note else null end
    from public.compensation_records r
    join public.organization_members m on m.user_id = r.employee_user_id and m.organization_id = p_organization_id
    where r.effective_to is null
      and m.manager_user_id = auth.uid()
      and public.manager_compensation_visibility(r.employee_user_id) in ('exact', 'band');
exception when others then
  return;
end;
$$;

revoke all on function public.list_team_compensation(uuid) from public;
grant execute on function public.list_team_compensation(uuid) to authenticated;

drop function if exists public.list_org_compensation(uuid);
create or replace function public.list_org_compensation(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_subjects uuid[];
begin
  if not public.has_compensation_access(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(array_agg(r.employee_user_id), '{}') into v_subjects
  from public.compensation_records r
  where r.organization_id = p_organization_id and r.effective_to is null;

  perform public.record_compensation_audit_event(
    p_organization_id, 'view_batch', v_subjects, null, format('list_org_compensation (%s employees)', array_length(v_subjects, 1))
  );

  return query
    select r.employee_user_id, r.salary_band_id, r.amount, r.currency, r.pay_frequency, r.effective_from,
           r.monthly_deduction_amount, r.deduction_note
    from public.compensation_records r
    where r.organization_id = p_organization_id and r.effective_to is null;
end;
$$;

revoke all on function public.list_org_compensation(uuid) from public;
grant execute on function public.list_org_compensation(uuid) to authenticated;

drop function if exists public.export_compensation_report(uuid);
create or replace function public.export_compensation_report(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_subjects uuid[];
begin
  if not public.has_compensation_access(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(array_agg(r.employee_user_id), '{}') into v_subjects
  from public.compensation_records r
  where r.organization_id = p_organization_id and r.effective_to is null;

  perform public.record_compensation_audit_event(
    p_organization_id, 'export', v_subjects, null, format('export_compensation_report (%s employees)', array_length(v_subjects, 1))
  );

  return query
    select r.employee_user_id, r.salary_band_id, r.amount, r.currency, r.pay_frequency, r.effective_from,
           r.monthly_deduction_amount, r.deduction_note
    from public.compensation_records r
    where r.organization_id = p_organization_id and r.effective_to is null;
end;
$$;

revoke all on function public.export_compensation_report(uuid) from public;
grant execute on function public.export_compensation_report(uuid) to authenticated;

drop function if exists public.list_compensation_proposals(uuid);
create or replace function public.list_compensation_proposals(p_organization_id uuid)
returns table (
  id uuid, employee_user_id uuid, proposed_by uuid, proposed_amount numeric, proposed_currency text,
  proposed_salary_band_id uuid, proposed_effective_date date, reason text, status text,
  created_at timestamptz, decided_at timestamptz, decided_by uuid,
  proposed_monthly_deduction_amount numeric, proposed_deduction_note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_is_admin boolean;
  v_subjects uuid[];
begin
  if not public.is_org_member(p_organization_id) then
    return;
  end if;
  v_is_admin := public.has_compensation_access(p_organization_id);

  select coalesce(array_agg(distinct p.employee_user_id), '{}') into v_subjects
  from public.compensation_proposals p
  where p.organization_id = p_organization_id
    and (v_is_admin or p.proposed_by = auth.uid());

  perform public.record_compensation_audit_event(
    p_organization_id, 'view_batch', v_subjects, null,
    format('list_compensation_proposals (%s, %s proposals)', case when v_is_admin then 'org-wide' else 'own submissions' end, array_length(v_subjects, 1))
  );

  return query
    select p.id, p.employee_user_id, p.proposed_by, p.proposed_amount, p.proposed_currency,
           p.proposed_salary_band_id, p.proposed_effective_date, p.reason, p.status,
           p.created_at, p.decided_at, p.decided_by,
           p.proposed_monthly_deduction_amount, p.proposed_deduction_note
    from public.compensation_proposals p
    where p.organization_id = p_organization_id
      and (v_is_admin or p.proposed_by = auth.uid())
    order by p.created_at desc;
exception when others then
  return;
end;
$$;

revoke all on function public.list_compensation_proposals(uuid) from public;
grant execute on function public.list_compensation_proposals(uuid) to authenticated;

-- ============================================================
-- Write RPCs — neither's return type changes, and the two new params on
-- propose_compensation_change are appended with defaults, so plain
-- CREATE OR REPLACE works (no drop needed) and no existing caller breaks.
-- ============================================================

create or replace function public.propose_compensation_change(
  p_organization_id uuid,
  p_employee_user_id uuid,
  p_proposed_amount numeric,
  p_proposed_currency text,
  p_proposed_salary_band_id uuid,
  p_proposed_effective_date date,
  p_reason text,
  p_proposed_monthly_deduction_amount numeric default null,
  p_proposed_deduction_note text default null
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
    proposed_salary_band_id, proposed_effective_date, reason,
    proposed_monthly_deduction_amount, proposed_deduction_note
  ) values (
    p_organization_id, p_employee_user_id, auth.uid(), p_proposed_amount, coalesce(p_proposed_currency, 'USD'),
    p_proposed_salary_band_id, p_proposed_effective_date, p_reason,
    p_proposed_monthly_deduction_amount, p_proposed_deduction_note
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.propose_compensation_change(uuid, uuid, numeric, text, uuid, date, text, numeric, text) from public;
grant execute on function public.propose_compensation_change(uuid, uuid, numeric, text, uuid, date, text, numeric, text) to authenticated;

-- decide_compensation_proposal's signature/return type are unchanged — only
-- its internal INSERT into compensation_records now also copies the
-- proposal's deduction fields onto the new current record.
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

revoke all on function public.decide_compensation_proposal(uuid, text, text) from public;
grant execute on function public.decide_compensation_proposal(uuid, text, text) to authenticated;
