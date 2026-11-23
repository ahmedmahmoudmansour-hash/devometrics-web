-- 0212: tighten who counts as "my report" for the 0211 read access (managers read the jobs their direct reports hold).
--
-- Why: 0211 matched on manager_user_id alone. Two gaps followed:
--   1. A leaver who was archived without their manager link being cleared still showed their job to the old manager.
--   2. manager_user_id points at any account (auth.users), and nothing in the database requires that account to belong to the same company.
--      Only the app's screens stopped a member of one company from naming a manager in another. Row-level security is the boundary, so the
--      database now requires it too.
--
-- Now a report counts only when the report is active (not archived) AND the signed-in manager is an active member of the same company.
-- The function keeps its name and signature, so the two 0211 policies use the new rule without being touched.
--
-- Safe to run more than once. Replaces one function. Changes no row and no policy.
-- To undo (back to the 0211 rule): run supabase/ROLLBACK_0212.sql.

create or replace function public.is_my_report_role(p_role_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- A single existence test, and it can never throw inside a policy: any problem means "no access".
  return exists (
    select 1
    from public.organization_members m
    join public.organization_members me
      on me.user_id = auth.uid()
     and me.organization_id = m.organization_id
     and me.archived = false
    where m.manager_user_id = auth.uid()
      and m.current_role_id = p_role_id
      and m.archived = false
  );
exception when others then
  return false;
end;
$$;

revoke all on function public.is_my_report_role(uuid) from public;
grant execute on function public.is_my_report_role(uuid) to authenticated;
