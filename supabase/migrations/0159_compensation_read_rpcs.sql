-- Compensation Management, part 6/7: read RPCs. This is the ONLY way any
-- client code ever reads compensation_records/proposals/approvals/changes
-- — those tables have no SELECT policy (0154/0155), so a direct
-- `.from(...).select()` returns an empty array by construction. Every
-- function here logs exactly one compensation_audit_log row per call via
-- record_compensation_audit_event() (0158), including batched roster
-- reads — a 25-person roster view produces ONE row listing 25 subject_user_ids,
-- not 25 rows.
--
-- Depends on 0157 (has_compensation_access, manager_compensation_visibility)
-- and 0158 (record_compensation_audit_event).

-- Caller's own current + historical compensation records.
create or replace function public.get_my_compensation()
returns table (
  id uuid, salary_band_id uuid, amount numeric, currency text, pay_frequency text,
  effective_from date, effective_to date, change_reason text, created_at timestamptz
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
           r.effective_from, r.effective_to, r.change_reason, r.created_at
    from public.compensation_records r
    where r.employee_user_id = auth.uid()
    order by r.effective_from desc;
exception when others then
  return;
end;
$$;

revoke all on function public.get_my_compensation() from public;
grant execute on function public.get_my_compensation() to authenticated;

-- A single record by id — authorized via self / manager-visibility / Comp
-- Admin, in that order. Logs exactly one 'view' row, or raises if none of
-- the three authorization paths apply.
create or replace function public.get_compensation_record(p_record_id uuid)
returns table (
  id uuid, organization_id uuid, employee_user_id uuid, salary_band_id uuid,
  amount numeric, currency text, pay_frequency text,
  effective_from date, effective_to date, change_reason text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_row public.compensation_records%rowtype;
  v_visibility text;
begin
  select * into v_row from public.compensation_records where id = p_record_id limit 1;
  if v_row.id is null then
    raise exception 'Not found';
  end if;

  if v_row.employee_user_id = auth.uid() then
    null; -- self, always allowed
  elsif public.has_compensation_access(v_row.organization_id) then
    null; -- Comp Admin, org-wide
  else
    v_visibility := public.manager_compensation_visibility(v_row.employee_user_id);
    if v_visibility not in ('exact', 'band') then
      raise exception 'Not authorized';
    end if;
  end if;

  perform public.record_compensation_audit_event(
    v_row.organization_id, 'view', array[v_row.employee_user_id]::uuid[], v_row.id, 'get_compensation_record'
  );

  return query
    select v_row.id, v_row.organization_id, v_row.employee_user_id, v_row.salary_band_id,
           -- band-only visibility never returns the exact figure, even for a single-record lookup
           case when v_row.employee_user_id = auth.uid() or public.has_compensation_access(v_row.organization_id)
                  or public.manager_compensation_visibility(v_row.employee_user_id) = 'exact'
                then v_row.amount else null end,
           v_row.currency, v_row.pay_frequency, v_row.effective_from, v_row.effective_to, v_row.change_reason, v_row.created_at;
end;
$$;

revoke all on function public.get_compensation_record(uuid) from public;
grant execute on function public.get_compensation_record(uuid) to authenticated;

-- A manager's direct-report roster, filtered/redacted per the org's
-- compensation_manager_visibility setting for each report individually
-- (manager_compensation_visibility is per-target-user, since it reads
-- is_manager_of_user, so this is safe even if reports span visibility
-- edge cases). A 'none' report is excluded from the result AND from
-- subject_user_ids — the log never even hints they were queried.
create or replace function public.list_team_compensation(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date, visibility text
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
           public.manager_compensation_visibility(r.employee_user_id)
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

-- Org-wide roster — Compensation Admin only.
create or replace function public.list_org_compensation(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date
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
    select r.employee_user_id, r.salary_band_id, r.amount, r.currency, r.pay_frequency, r.effective_from
    from public.compensation_records r
    where r.organization_id = p_organization_id and r.effective_to is null;
end;
$$;

revoke all on function public.list_org_compensation(uuid) from public;
grant execute on function public.list_org_compensation(uuid) to authenticated;

-- Functionally a very large batched read — logged with the same rigor as
-- list_org_compensation, distinct 'export' action so the audit trail
-- distinguishes "looked at the roster" from "downloaded the roster".
create or replace function public.export_compensation_report(p_organization_id uuid)
returns table (
  employee_user_id uuid, salary_band_id uuid, amount numeric, currency text,
  pay_frequency text, effective_from date
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
    select r.employee_user_id, r.salary_band_id, r.amount, r.currency, r.pay_frequency, r.effective_from
    from public.compensation_records r
    where r.organization_id = p_organization_id and r.effective_to is null;
end;
$$;

revoke all on function public.export_compensation_report(uuid) from public;
grant execute on function public.export_compensation_report(uuid) to authenticated;

-- The proposal queue. A Compensation Admin sees every proposal in the org
-- (what a Comp Admin dashboard needs to decide on); anyone else sees only
-- the proposals THEY submitted (so a manager can track a proposal's
-- status without being able to see the org-wide queue). Proposals contain
-- a dollar figure, so this is logged like any other read.
create or replace function public.list_compensation_proposals(p_organization_id uuid)
returns table (
  id uuid, employee_user_id uuid, proposed_by uuid, proposed_amount numeric, proposed_currency text,
  proposed_salary_band_id uuid, proposed_effective_date date, reason text, status text,
  created_at timestamptz, decided_at timestamptz, decided_by uuid
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
           p.created_at, p.decided_at, p.decided_by
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
