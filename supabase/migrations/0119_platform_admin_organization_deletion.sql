-- 0119: Platform-admin-triggered organization deletion (any org, not just
-- one the caller happens to be an admin of)
--
-- deleteOrganization (lib/organizations/actions.ts) only works when the
-- caller is that specific org's own admin (RLS: "Org admins can update
-- their own organization", migration 0033) — it can't be used by a
-- platform admin (profiles.is_admin = true) to clean up test/demo
-- companies across the whole platform. This mirrors 0111's
-- platform_admin_schedule_data_deletion pair exactly, just targeting
-- organizations.pending_deletion_at instead of profiles.pending_data_
-- deletion_at — same SECURITY DEFINER, narrowly-scoped-to-one-column
-- approach (not a blanket RLS UPDATE policy), same daily purge cron
-- (purge_scheduled_organization_deletions, migration 0059) as every other
-- path into this same deletion mechanism.

create or replace function public.platform_admin_schedule_organization_deletion(target_org_id uuid, grace_days int default 30)
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
  update public.organizations set pending_deletion_at = deletion_at where id = target_org_id;

  return deletion_at;
end;
$$;

revoke all on function public.platform_admin_schedule_organization_deletion(uuid, int) from public;
grant execute on function public.platform_admin_schedule_organization_deletion(uuid, int) to authenticated;

create or replace function public.platform_admin_cancel_organization_deletion(target_org_id uuid)
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

  update public.organizations set pending_deletion_at = null where id = target_org_id;
end;
$$;

revoke all on function public.platform_admin_cancel_organization_deletion(uuid) from public;
grant execute on function public.platform_admin_cancel_organization_deletion(uuid) to authenticated;
