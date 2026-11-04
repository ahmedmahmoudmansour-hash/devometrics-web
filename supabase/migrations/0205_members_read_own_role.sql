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
