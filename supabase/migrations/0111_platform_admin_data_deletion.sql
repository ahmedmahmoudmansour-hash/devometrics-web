-- 0111: Platform-admin-triggered data deletion (any user, not just an org's
-- own employees)
--
-- admin_schedule_employee_data_deletion (migration 0066) only works when
-- the caller is the target's own org admin (is_org_admin_of_user) — it
-- can't be used by a platform admin (profiles.is_admin = true) to schedule
-- deletion for an arbitrary user across the whole platform, e.g. cleaning
-- up a test/demo account or an individual user with no organization at
-- all. This mirrors 0066's pair of functions exactly, just gated on the
-- caller's own is_admin flag instead of org-admin-of-user — same
-- SECURITY DEFINER, narrowly-scoped-to-one-column approach (not a blanket
-- RLS UPDATE policy on profiles), same underlying pending_data_deletion_at
-- column and daily purge cron (migration 0059) as every other path into
-- this same deletion mechanism.

create or replace function public.platform_admin_schedule_data_deletion(target_user_id uuid, grace_days int default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  deletion_at timestamptz;
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  deletion_at := now() + (grace_days || ' days')::interval;
  update public.profiles set pending_data_deletion_at = deletion_at where id = target_user_id;

  return deletion_at;
end;
$$;

revoke all on function public.platform_admin_schedule_data_deletion(uuid, int) from public;
grant execute on function public.platform_admin_schedule_data_deletion(uuid, int) to authenticated;

create or replace function public.platform_admin_cancel_data_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  update public.profiles set pending_data_deletion_at = null where id = target_user_id;
end;
$$;

revoke all on function public.platform_admin_cancel_data_deletion(uuid) from public;
grant execute on function public.platform_admin_cancel_data_deletion(uuid) to authenticated;
