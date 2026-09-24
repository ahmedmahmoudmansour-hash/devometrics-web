-- Two compensation read functions (latest definitions in 0165) have
-- unqualified column names inside a plpgsql function whose RETURNS TABLE
-- columns share those names. plpgsql treats the output columns as variables,
-- so a bare `effective_to`, `organization_id`, `employee_user_id` or `id` is
-- ambiguous and raises "column reference ... is ambiguous".
--
--  * get_my_compensation: the audit-log sub-select used bare column names and
--    the function's catch-all `exception when others then return` swallowed
--    the error, so it returned ZERO rows for everyone, always -- an employee
--    could never see their own compensation record (My Compensation on the
--    profile page was permanently empty). Found 2026-09-24 by comparing the
--    admin roster (shows the record) with the employee's own call ([]).
--  * get_compensation_record: `where id = p_record_id` hit the same ambiguity
--    and raised instead of returning the record.
--
-- Bodies are exactly 0165's (including the deduction columns and the
-- exact/band visibility rules); the ONLY change is aliasing the table so the
-- columns are qualified. drop-then-create because 0165 did the same (the
-- return type includes the deduction columns).

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
  select cr.* into v_row from public.compensation_records cr where cr.id = p_record_id limit 1;
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
