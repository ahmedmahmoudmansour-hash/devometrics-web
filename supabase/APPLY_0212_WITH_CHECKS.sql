-- ============================================================================
-- DEVOMETRICS: APPLY PACK FOR MIGRATION 0212 (tighten managers' read access to their reports' jobs)
-- Fixes: a manager could still see the job of a report who had left (archived), and the rule did not check that the manager and
-- the report are in the same company.
--
-- Paste this whole file into the Supabase SQL Editor and press Run. One paste. It changes no data.
-- It replaces one function. The last result is a check table: every row should say PASS.
-- Needs 0211 applied first (the first check says so if it is not).
-- To undo: run supabase/ROLLBACK_0212.sql.
-- ============================================================================

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


-- ---------------------------------------------------------------------------
-- Checks (the last result shown). Every row should say PASS.
select check_name, case when ok then 'PASS' else 'FAIL' end as result, detail
from (
  select 'the 0211 job roles policy exists (0211 was applied)' as check_name,
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_roles' and policyname = 'Managers read their reports current roles' and cmd = 'SELECT') as ok,
         'apply 0211 first if this fails' as detail
  union all
  select 'the 0211 role requirements policy exists',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'role_competency_requirements' and policyname = 'Managers read their reports role requirements' and cmd = 'SELECT'),
         'select only'
  union all
  select 'the helper now ignores archived reports',
         coalesce(pg_get_functiondef(to_regprocedure('public.is_my_report_role(uuid)')) ilike '%m.archived = false%', false),
         'function body checks archived'
  union all
  select 'the helper now requires the same company',
         coalesce(pg_get_functiondef(to_regprocedure('public.is_my_report_role(uuid)')) ilike '%me.organization_id = m.organization_id%', false),
         'function body checks the company'
  union all
  select 'the helper is still security definer with a fixed search path',
         exists (select 1 from pg_proc where oid = to_regprocedure('public.is_my_report_role(uuid)') and prosecdef and array_to_string(proconfig, ',') ilike '%search_path=public%'),
         'security definer, search_path=public'
  union all
  select 'the helper denies an unknown role (no one is signed in here)',
         public.is_my_report_role(gen_random_uuid()) = false,
         'returns false, never an error'
  union all
  select 'the own-job policy from 0205 is untouched',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_roles' and policyname = 'Members read their own current role'),
         'existing policy still present'
) c
order by ok, check_name;
