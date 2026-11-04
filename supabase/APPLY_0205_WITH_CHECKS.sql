-- ============================================================================
-- DEVOMETRICS: APPLY PACK FOR MIGRATION 0205 (members read their own current role)
-- Fixes: "Employees can start their own assessment" always ended with "The person's role could not be found".
--
-- Paste this whole file into the Supabase SQL Editor and press Run. One paste. It changes no data.
-- It adds one function and two read-only policies. The last result is a check table: every row should say PASS.
-- To undo: run supabase/ROLLBACK_0205.sql.
-- ============================================================================

-- 0205: let a person read their own current role and its required competencies.
--
-- Why: "Employees can start their own assessment" reads the person's role and its requirements. Job roles and role
-- requirements could be read by org admins only, so every self-started assessment stopped with
-- "The person's role could not be found". (An assessment assigned by a manager or admin was never affected.)
--
-- What this exposes: only the signed-in person's OWN current role (title, level, grade, track, responsibilities) and that
-- role's required competencies. Nothing about pay. Every other role stays admin-only, and nothing is written.
--
-- Safe to run more than once. Adds one function and two read-only policies. Changes no row and no existing policy.
-- To undo: run supabase/ROLLBACK_0205.sql.

create or replace function public.is_my_current_role(p_role_id uuid)
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
    where m.user_id = auth.uid() and m.current_role_id = p_role_id
  );
exception when others then
  return false;
end;
$$;

revoke all on function public.is_my_current_role(uuid) from public;
grant execute on function public.is_my_current_role(uuid) to authenticated;

drop policy if exists "Members read their own current role" on public.job_roles;
create policy "Members read their own current role"
  on public.job_roles for select
  using (public.is_my_current_role(id));

drop policy if exists "Members read their own role requirements" on public.role_competency_requirements;
create policy "Members read their own role requirements"
  on public.role_competency_requirements for select
  using (public.is_my_current_role(role_id));


-- ---------------------------------------------------------------------------
-- Checks (the last result shown). Every row should say PASS.
select check_name, case when ok then 'PASS' else 'FAIL' end as result, detail
from (
  select 'the helper function exists' as check_name,
         to_regprocedure('public.is_my_current_role(uuid)') is not null as ok,
         'is_my_current_role(uuid)' as detail
  union all
  select 'the job roles policy exists',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_roles' and policyname = 'Members read their own current role' and cmd = 'SELECT'),
         'select only'
  union all
  select 'the role requirements policy exists',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'role_competency_requirements' and policyname = 'Members read their own role requirements' and cmd = 'SELECT'),
         'select only'
  union all
  select 'the helper denies an unknown role (no one is signed in here)',
         public.is_my_current_role(gen_random_uuid()) = false,
         'returns false, never an error'
  union all
  select 'the admin-only manage policy on job roles is untouched',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_roles' and policyname = 'Org admins manage job roles'),
         'existing policy still present'
) c
order by ok, check_name;
