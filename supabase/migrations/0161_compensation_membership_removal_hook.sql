-- Compensation Management, part 8/8 (added after the initial 7-migration
-- batch, during a pre-apply self-review — none of 0154-0160 had been run
-- yet, so this slots into the same PENDING_MIGRATIONS.sql batch rather than
-- landing as a later patch).
--
-- Gap found: compensation_records.employee_user_id/organization_id
-- reference auth.users/organizations directly, NOT organization_members —
-- so when someone leaves an org (leaveOrganization in
-- lib/organizations/actions.ts, a plain `delete from organization_members`)
-- their still-open current compensation_records row (effective_to is null)
-- was never closed. They'd keep showing up in list_org_compensation's
-- "current roster" indefinitely, looking actively employed. This closes
-- that row the same day their membership ends, without deleting any
-- history — the row itself is retained for audit purposes, exactly like
-- every other closed compensation_records row.
--
-- Depends on 0154 (compensation_records).

create or replace function public.trg_close_compensation_on_membership_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.compensation_records
  set effective_to = current_date
  where organization_id = old.organization_id
    and employee_user_id = old.user_id
    and effective_to is null;
  return old;
exception when others then
  return old; -- never let this block the membership deletion it's reacting to
end;
$$;

drop trigger if exists compensation_close_on_membership_removal on public.organization_members;
create trigger compensation_close_on_membership_removal
  after delete on public.organization_members
  for each row execute function public.trg_close_compensation_on_membership_removal();
