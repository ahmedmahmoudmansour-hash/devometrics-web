-- ROLLBACK for migration 0205 (members read their own current role). Safe: removes two read policies and one function only.
drop policy if exists "Members read their own role requirements" on public.role_competency_requirements;
drop policy if exists "Members read their own current role" on public.job_roles;
drop function if exists public.is_my_current_role(uuid);
