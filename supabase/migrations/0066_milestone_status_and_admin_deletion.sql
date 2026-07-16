-- Two additions:
--
-- 1. Milestone status (in_progress / completed / deferred) — the existing
--    `completed` boolean stays exactly as-is, since ~30 other places
--    (analytics, achievements, calendar feed, exports, task widgets) already
--    read it and none of them need to change. `status` is purely additive;
--    the app keeps `completed` in sync whenever status changes, so every
--    existing reader keeps working without modification.
--
-- 2. Admin-triggered employee data deletion — enterprise employees should
--    not be able to unilaterally delete data their employer has a
--    legitimate governance interest in; only an org admin can schedule (or
--    cancel) deletion of an employee's data. Mirrors the self-service
--    scheduled-deletion mechanism (migration 0059) exactly, just callable
--    on someone else's behalf, narrowly scoped via SECURITY DEFINER (not a
--    blanket RLS UPDATE policy on profiles, which would let an admin edit
--    anything on the row, not just trigger deletion) and gated through the
--    same is_org_admin_of_user() helper every other admin-visibility check
--    in this app already uses.

alter table public.milestones
  add column if not exists status text not null default 'in_progress'
  check (status in ('in_progress', 'completed', 'deferred'));

update public.milestones set status = 'completed' where completed = true and status = 'in_progress';

create or replace function public.admin_schedule_employee_data_deletion(employee_id uuid, grace_days int default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  deletion_at timestamptz;
begin
  if not public.is_org_admin_of_user(employee_id) then
    raise exception 'Not authorized';
  end if;

  deletion_at := now() + (grace_days || ' days')::interval;
  update public.profiles set pending_data_deletion_at = deletion_at where id = employee_id;

  return deletion_at;
end;
$$;

revoke all on function public.admin_schedule_employee_data_deletion(uuid, int) from public;
grant execute on function public.admin_schedule_employee_data_deletion(uuid, int) to authenticated;

create or replace function public.admin_cancel_employee_data_deletion(employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin_of_user(employee_id) then
    raise exception 'Not authorized';
  end if;

  update public.profiles set pending_data_deletion_at = null where id = employee_id;
end;
$$;

revoke all on function public.admin_cancel_employee_data_deletion(uuid) from public;
grant execute on function public.admin_cancel_employee_data_deletion(uuid) to authenticated;
