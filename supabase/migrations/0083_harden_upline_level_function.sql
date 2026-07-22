-- Confirmed live regression: after 0082, the admin's own Impact Cycles
-- roster (listReviewsForCycle) started returning empty for every company,
-- not just new ones — reproduced on two separate, pre-existing orgs.
-- Pinpointed cause: the original function's `select ... into` calls had no
-- `limit 1`, so plpgsql throws "query returned more than one row" the
-- moment target_user_id (or a manager found while walking the chain)
-- matches more than one organization_members row — routine in a
-- multi-tenant app where an account can belong to more than one org.
-- upline_level_of_user() is called from a permissive RLS policy on
-- performance_reviews (and sibling tables). Postgres combines multiple
-- permissive policies for the same command with OR, but if ANY policy's
-- USING expression throws while evaluating a row, the ENTIRE query aborts
-- — even for rows the pre-existing "Admins manage reviews" policy would
-- have separately allowed. A helper function used inside RLS must never be
-- allowed to raise, or its blast radius extends to every other policy on
-- the same table. Fixing the missing `limit 1` in both lookups, plus
-- wrapping the whole body in an exception handler that always degrades to
-- "not in the chain" (null) rather than ever failing the calling query, so
-- no future edge case in this function can repeat this failure mode.
create or replace function public.upline_level_of_user(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_current uuid;
  v_org_id uuid;
  v_max_level integer;
  v_level integer := 0;
begin
  select organization_id, manager_user_id into v_org_id, v_current
  from public.organization_members
  where user_id = target_user_id
  limit 1;

  if v_org_id is null then
    return null;
  end if;

  select least(coalesce(review_escalation_levels, 1), 10) into v_max_level
  from public.organizations where id = v_org_id;

  while v_current is not null and v_level < coalesce(v_max_level, 1) loop
    v_level := v_level + 1;
    if v_current = auth.uid() then
      return v_level;
    end if;
    select manager_user_id into v_current
    from public.organization_members
    where user_id = v_current and organization_id = v_org_id
    limit 1;
  end loop;

  return null;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.upline_level_of_user(uuid) from public;
grant execute on function public.upline_level_of_user(uuid) to authenticated;
