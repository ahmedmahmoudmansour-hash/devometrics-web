-- 0137: Resolve escalations + an org-wide escalated-reviews summary
--
-- Two follow-ups the CEO flagged right after 0136 shipped:
--
-- 1. The "Escalated" badge (0136) had no way to be cleared — once
--    escalation_requested_at was set, it showed forever, even after the
--    concern was actually addressed. Adds escalation_resolved_at/_by and a
--    manager/admin-only RPC to set them (same auth shape as
--    submit_manager_assessment: is_org_admin OR is_manager_of_user).
--
-- 2. HR had no aggregate view of how many reviews are currently escalated
--    org-wide — same gap pattern get_overdue_assignments (0128) already
--    solved for milestones/assessments/Knowledge Hub, just never extended
--    to cover this. Adds a matching read-only RPC.

alter table public.performance_reviews
  add column if not exists escalation_resolved_at timestamptz,
  add column if not exists escalation_resolved_by uuid references auth.users(id) on delete set null;

create or replace function public.resolve_review_escalation(target_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  update public.performance_reviews
    set escalation_resolved_at = now(), escalation_resolved_by = auth.uid()
    where id = target_review_id;
end;
$$;

revoke all on function public.resolve_review_escalation(uuid) from public;
grant execute on function public.resolve_review_escalation(uuid) to authenticated;

-- Read-only, admin-gated (live authenticated-caller check, same posture as
-- get_overdue_assignments — not the cron-secret pattern, since this is
-- called from the Impact Cycles admin page, not a cron job).
create or replace function public.get_escalated_reviews(target_organization_id uuid)
returns table(
  review_id uuid,
  employee_user_id uuid,
  employee_name text,
  cycle_name text,
  escalation_requested_at timestamptz,
  escalation_comment text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(target_organization_id) then
    raise exception 'Not authorized';
  end if;

  return query
    select r.id, r.employee_user_id, p.full_name, cyc.name, r.escalation_requested_at, r.escalation_comment
    from public.performance_reviews r
    join public.performance_review_cycles cyc on cyc.id = r.cycle_id
    join public.profiles p on p.id = r.employee_user_id
    where r.organization_id = target_organization_id
      and r.escalation_requested_at is not null
      and r.escalation_resolved_at is null
    order by r.escalation_requested_at asc
    limit 50;
end;
$$;

revoke all on function public.get_escalated_reviews(uuid) from public;
grant execute on function public.get_escalated_reviews(uuid) to authenticated;
