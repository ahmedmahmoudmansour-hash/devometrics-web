-- Three findings from a full behavioral security audit of Compensation
-- Management (2026-09-28), each confirmed LIVE against the real database
-- with a throwaway test org/accounts, not just found by code review:
--
-- 1. [CRITICAL] Cross-org proposal injection. propose_compensation_change's
--    authorization check was `is_manager_of_user(p_employee_user_id) OR
--    has_compensation_access(p_organization_id)` -- but is_manager_of_user
--    is NOT org-scoped (it matches the manager relationship in ANY org the
--    two share), and nothing verified p_employee_user_id is even a member
--    of p_organization_id. CONFIRMED: a manager in Org A, with zero
--    relationship to Org B (not even a member), successfully created a
--    compensation_proposals row tagged organization_id = Org B for their
--    Org-A report. Once a genuine Org-B Compensation Admin approved it
--    (exactly the intended, unmodified approval flow), that report showed
--    up as an actively-employed person earning a fabricated salary in Org
--    B's official compensation roster (list_org_compensation) -- despite
--    never having been a member of Org B. Fixed by adding
--    is_manager_of_user_in_org(), an org-scoped sibling of the existing
--    is_manager_of_user(), and using it here instead. Also adds a
--    defense-in-depth check in decide_compensation_proposal itself (the
--    employee must actually be a member of the proposal's organization_id)
--    so no other future proposal-creation path can reintroduce this by
--    skipping propose_compensation_change.
--
-- 2. [CRITICAL] Read-side audit logging has never actually written a row.
--    All six read RPCs (get_my_compensation, get_compensation_record,
--    list_team_compensation, list_org_compensation,
--    export_compensation_report, list_compensation_proposals) are marked
--    STABLE. PostgREST executes STABLE/IMMUTABLE-marked RPCs in a
--    read-only transaction; the nested INSERT inside
--    record_compensation_audit_event then fails, and that failure is
--    silently swallowed by record_compensation_audit_event's own
--    `exception when others then null` (added so a logging failure could
--    never block a real read -- which also made this specific failure
--    completely invisible). CONFIRMED: queried compensation_audit_log for
--    every 'view'/'view_batch'/'export' row that has EVER existed --  zero,
--    other than one inserted by calling the logging helper directly
--    (VOLATILE, not wrapped in a read-only transaction) to isolate the
--    bug. This defeats the entire reason these four tables have zero
--    client-facing RLS policies in the first place ("every read is
--    audited"). Fixed by dropping STABLE from all six -- they perform a
--    real write as a side effect, so they were never actually stable.
--
-- 3. [MEDIUM] Self-approval-guard lockout via a stale Compensation Admin
--    grant. decide_compensation_proposal's self-approval guard (0168)
--    correctly blocks self-decision ONLY when another eligible decider
--    exists -- but its existence check
--    (`organization_compensation_admins where ... user_id <> auth.uid()`)
--    never verifies that other admin is still a CURRENT ACTIVE org member,
--    unlike has_compensation_access (which correctly ANDs with
--    is_org_member). organization_compensation_admins is never cleaned up
--    when someone's employment_status changes (only compensation_records
--    is, via 0161's trigger). CONFIRMED: granted a second Compensation
--    Admin, set their employment_status to 'terminated' (the real
--    offboarding path -- their organization_compensation_admins row is
--    never touched by that), and the sole remaining ACTIVE Compensation
--    Admin was permanently blocked from deciding their own proposal,
--    citing "another Compensation Admin is available" for someone who no
--    longer has any real access at all. Fixed by requiring the other
--    admin's grant to be paired with a current active organization_members
--    row.
--
-- Also drops a stale overloaded propose_compensation_change(7 params) left
-- behind by 0165: adding two new parameters via `create or replace
-- function` doesn't replace a function whose parameter list changed --
-- Postgres creates an additional overload instead. Both versions have
-- coexisted since 0165. The app itself always calls with all 9 named
-- params (lib/compensation/actions.ts) so it was never affected, but any
-- other caller supplying exactly the original 7 gets a PGRST203 "ambiguous
-- overload" error instead of a clean call.
--
-- Depends on 0157 (is_manager_of_user, the pattern this mirrors), 0165/
-- 0180 (the latest bodies of every function touched here -- every
-- redefinition below is that latest body with only the audited fix
-- applied, nothing else changed).

-- ============================================================
-- Fix 1a: org-scoped manager-relationship helper.
-- ============================================================
create or replace function public.is_manager_of_user_in_org(target_user_id uuid, check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.organization_members
      where organization_id = check_org_id and user_id = target_user_id and manager_user_id = auth.uid()
    )
    and exists (
      select 1 from public.organization_members
      where organization_id = check_org_id and user_id = auth.uid() and employment_status = 'active'
    );
$$;

revoke all on function public.is_manager_of_user_in_org(uuid, uuid) from public;
grant execute on function public.is_manager_of_user_in_org(uuid, uuid) to authenticated;

-- ============================================================
-- Fix 1b + stale-overload cleanup: propose_compensation_change now checks
-- the org-scoped helper instead of the global is_manager_of_user. Dropping
-- both possible prior signatures first (the original 7-param and 0165's
-- 9-param) guarantees exactly one version exists afterward, regardless of
-- which one(s) are currently live.
-- ============================================================
drop function if exists public.propose_compensation_change(uuid, uuid, numeric, text, uuid, date, text);
drop function if exists public.propose_compensation_change(uuid, uuid, numeric, text, uuid, date, text, numeric, text);

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
  if not (public.is_manager_of_user_in_org(p_employee_user_id, p_organization_id) or public.has_compensation_access(p_organization_id)) then
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

-- ============================================================
-- Fix 1c (defense in depth) + Fix 3: decide_compensation_proposal now
-- rejects a proposal whose employee isn't a member of its own
-- organization_id, and the self-approval guard requires the other admin's
-- grant to be paired with a CURRENT ACTIVE membership row.
-- ============================================================
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

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_proposal.organization_id and user_id = v_proposal.employee_user_id
  ) then
    raise exception 'This proposal references an employee who is not a member of this organization';
  end if;

  if v_proposal.employee_user_id = auth.uid() and exists (
    select 1 from public.organization_compensation_admins oca
    join public.organization_members om
      on om.organization_id = oca.organization_id and om.user_id = oca.user_id and om.employment_status = 'active'
    where oca.organization_id = v_proposal.organization_id and oca.user_id <> auth.uid()
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

revoke all on function public.decide_compensation_proposal(uuid, text, text) from public;
grant execute on function public.decide_compensation_proposal(uuid, text, text) to authenticated;

-- ============================================================
-- Fix 2: drop STABLE from all six read RPCs -- each has a genuine write
-- side effect (the audit-log insert) and was never actually stable.
-- Bodies below are byte-for-byte 0165/0180's latest, only the volatility
-- category changed. No DROP needed for any of these: only the return-type
-- changes across this codebase have ever required a drop, and none of
-- these six change return type here.
-- ============================================================

create or replace function public.get_my_compensation()
returns table (
  id uuid, salary_band_id uuid, amount numeric, currency text, pay_frequency text,
  effective_from date, effective_to date, change_reason text, created_at timestamptz,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_compensation_audit_event(
    (select c.organization_id from public.compensation_records c where c.employee_user_id = auth.uid() and c.effective_to is null limit 1),
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
as $$
declare
  v_row public.compensation_records%rowtype;
  v_visibility text;
  v_can_see_exact boolean;
begin
  select cr.* into v_row from public.compensation_records cr where cr.id = p_record_id limit 1;
  if v_row.id is null then
    raise exception 'Not found';
  end if;

  if v_row.employee_user_id = auth.uid() then
    v_can_see_exact := true;
  elsif public.has_compensation_access(v_row.organization_id) then
    v_can_see_exact := true;
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
           case when v_can_see_exact then v_row.amount else null end,
           v_row.currency, v_row.pay_frequency, v_row.effective_from, v_row.effective_to, v_row.change_reason, v_row.created_at,
           case when v_can_see_exact then v_row.monthly_deduction_amount else null end,
           case when v_can_see_exact then v_row.deduction_note else null end;
end;
$$;
revoke all on function public.get_compensation_record(uuid) from public;
grant execute on function public.get_compensation_record(uuid) to authenticated;

create or replace function public.list_team_compensation(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date, visibility text,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
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

create or replace function public.list_org_compensation(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
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

create or replace function public.export_compensation_report(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date,
  monthly_deduction_amount numeric, deduction_note text
)
language plpgsql
security definer
set search_path = public
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
