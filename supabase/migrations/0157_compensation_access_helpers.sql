-- Compensation Management, part 4/8: SECURITY DEFINER access-check
-- helpers, used by both the RLS policies added in 0158/0159 and the RPCs
-- added in 0160/0161. Depends on 0154 (organizations.
-- compensation_manager_visibility) and 0156 (organization_compensation_admins).

-- Plain exists() — cannot throw on cardinality, same shape as
-- is_org_admin/is_org_member (0016). Requires CURRENT org membership, not
-- just a grant row: a grant alone would let someone who's since left the
-- org (fired, transferred) keep full salary access forever, since nothing
-- else in this app cleans up organization_compensation_admins when
-- organization_members is deleted. Every other permission check in this
-- codebase (is_org_admin, is_manager_of_user) implicitly requires current
-- membership; this one must too.
create or replace function public.has_compensation_access(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_compensation_admins
    where organization_id = check_org_id and user_id = auth.uid()
  ) and public.is_org_member(check_org_id);
$$;

revoke all on function public.has_compensation_access(uuid) from public;
grant execute on function public.has_compensation_access(uuid) to authenticated;

-- Effective visibility the CALLER (auth.uid()) has into target_user_id's
-- compensation, as their manager. plpgsql + a multi-row-shaped lookup, so
-- per this repo's RLS-helper discipline: LIMIT 1 on every select..into,
-- and an exception handler defaulting to 'none' — the safe/deny-ish
-- default — so a throw here can never propagate into a calling policy or
-- RPC and abort an unrelated caller's query. Tested (see plan's security
-- test matrix, case 20) against a user who is a manager in two orgs at
-- once, the exact shape that has broken a helper like this in this
-- codebase before.
create or replace function public.manager_compensation_visibility(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org_id uuid;
  v_setting text;
begin
  if not public.is_manager_of_user(target_user_id) then
    return 'none';
  end if;

  select organization_id into v_org_id
  from public.organization_members
  where user_id = target_user_id and manager_user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    return 'none';
  end if;

  select compensation_manager_visibility into v_setting
  from public.organizations
  where id = v_org_id
  limit 1;

  return coalesce(v_setting, 'none');
exception when others then
  return 'none';
end;
$$;

revoke all on function public.manager_compensation_visibility(uuid) from public;
grant execute on function public.manager_compensation_visibility(uuid) to authenticated;
