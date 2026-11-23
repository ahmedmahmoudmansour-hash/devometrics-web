-- ROLLBACK for migration 0211 (managers read their reports' jobs). Safe: removes two read policies and one function only.
drop policy if exists "Managers read their reports role requirements" on public.role_competency_requirements;
drop policy if exists "Managers read their reports current roles" on public.job_roles;
drop function if exists public.is_my_report_role(uuid);
