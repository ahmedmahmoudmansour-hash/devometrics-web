-- Fixes a real, pre-existing bug in migration 0041: querying public.surveys
-- as an org admin throws "infinite recursion detected in policy for
-- relation surveys" (Postgres 42P17). Root cause is a circular RLS
-- reference between two tables:
--
--   surveys' "Assigned employees can view their surveys" policy queries
--   survey_assignments directly (raw subquery, RLS-checked) ...
--
--   ...and survey_assignments' "Org admins manage assignments for their
--   surveys" policy queries surveys right back (also a raw subquery,
--   RLS-checked) ...
--
-- ...so evaluating either table's RLS re-triggers the other's, which
-- re-triggers the first, forever. This never surfaced before because
-- nothing had queried surveys in a context where Postgres needed to
-- evaluate both permissive SELECT policies together — caught via a live
-- admin-facing count query.
--
-- The fix is the same one already used everywhere else in this schema for
-- exactly this shape of problem (is_org_admin, is_org_admin_of_user):
-- move the cross-table check into a SECURITY DEFINER function. Definer
-- functions run with elevated privilege and don't re-trigger the RLS of
-- the tables they query internally, which is what breaks the cycle.

create or replace function public.is_assigned_to_survey(check_survey_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.survey_assignments sa
    where sa.survey_id = check_survey_id and sa.employee_user_id = auth.uid()
  )
$$;

revoke all on function public.is_assigned_to_survey(uuid) from public;
grant execute on function public.is_assigned_to_survey(uuid) to anon, authenticated;

drop policy if exists "Assigned employees can view their surveys" on public.surveys;
create policy "Assigned employees can view their surveys"
  on public.surveys for select
  using (public.is_assigned_to_survey(id));

-- Same fix on the other side of the cycle: survey_assignments' admin
-- policy queried surveys directly, which is the other half of the loop.
-- is_org_admin_of_user already exists and is the same helper the rest of
-- this app uses for "is this the admin of this employee's org" checks —
-- reused here via the assignment's own employee_user_id rather than
-- re-deriving organization_id through another raw surveys subquery.
drop policy if exists "Org admins manage assignments for their surveys" on public.survey_assignments;
create policy "Org admins manage assignments for their surveys"
  on public.survey_assignments for all
  using (public.is_org_admin_of_user(employee_user_id))
  with check (public.is_org_admin_of_user(employee_user_id));
