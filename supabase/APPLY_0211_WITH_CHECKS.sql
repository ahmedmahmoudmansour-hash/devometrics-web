-- ============================================================================
-- DEVOMETRICS: APPLY PACK FOR MIGRATION 0211 (managers read their reports' jobs)
-- Fixes: a line manager who is not an admin saw "no job" for everyone on their team, so team readiness and
-- role-assessment pickers had nothing to work with.
--
-- Paste this whole file into the Supabase SQL Editor and press Run. One paste. It changes no data.
-- It adds one function and two read-only policies. The last result is a check table: every row should say PASS.
-- To undo: run supabase/ROLLBACK_0211.sql.
-- ============================================================================

-- 0211: let a line manager read the jobs their direct reports hold (and what those jobs require).
--
-- Why: job roles and role requirements could be read by org admins, and (0205) by a person for their OWN job only. A line manager who is
-- not an admin therefore could not see the job title of anyone on their team: My Team showed "no job" for every report, and the team
-- readiness view had nothing to compare against.
--
-- What this exposes: only the jobs (title, level, grade, track, responsibilities) that at least one of the signed-in manager's direct
-- reports currently holds, and those jobs' required competencies. Nothing about pay. Every other job stays admin-only. Nothing is written.
--
-- Safe to run more than once. Adds one function and two read-only policies. Changes no row and no existing policy.
-- To undo: run supabase/ROLLBACK_0211.sql.

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
    select 1 from public.organization_members m
    where m.manager_user_id = auth.uid() and m.current_role_id = p_role_id
  );
exception when others then
  return false;
end;
$$;

revoke all on function public.is_my_report_role(uuid) from public;
grant execute on function public.is_my_report_role(uuid) to authenticated;

drop policy if exists "Managers read their reports current roles" on public.job_roles;
create policy "Managers read their reports current roles"
  on public.job_roles for select
  using (public.is_my_report_role(id));

drop policy if exists "Managers read their reports role requirements" on public.role_competency_requirements;
create policy "Managers read their reports role requirements"
  on public.role_competency_requirements for select
  using (public.is_my_report_role(role_id));


-- ---------------------------------------------------------------------------
-- Checks (the last result shown). Every row should say PASS.
select check_name, case when ok then 'PASS' else 'FAIL' end as result, detail
from (
  select 'the helper function exists' as check_name,
         to_regprocedure('public.is_my_report_role(uuid)') is not null as ok,
         'is_my_report_role(uuid)' as detail
  union all
  select 'the job roles policy exists',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_roles' and policyname = 'Managers read their reports current roles' and cmd = 'SELECT'),
         'select only'
  union all
  select 'the role requirements policy exists',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'role_competency_requirements' and policyname = 'Managers read their reports role requirements' and cmd = 'SELECT'),
         'select only'
  union all
  select 'the helper denies an unknown role (no one is signed in here)',
         public.is_my_report_role(gen_random_uuid()) = false,
         'returns false, never an error'
  union all
  select 'the admin-only manage policy on job roles is untouched',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_roles' and policyname = 'Org admins manage job roles'),
         'existing policy still present'
  union all
  select 'the own-job policy from 0205 is untouched',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_roles' and policyname = 'Members read their own current role'),
         'existing policy still present'
) c
order by ok, check_name;
