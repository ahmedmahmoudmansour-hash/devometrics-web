-- Case Study Exercises had no admin-read RLS policy at all — migration
-- 0028 only granted the employee themselves read/write on their own rows
-- (auth.uid() = user_id). That's a real gap once an admin assigns an
-- exercise via the existing assigned_assessments mechanism (0058): the
-- admin's per-employee report page would query this table and get zero
-- rows back, no matter what the employee actually submitted, with no
-- error to explain why.
--
-- Same precedent as 0016's existing "Org admins can view their members'
-- assessment results" policy on assessment_results — blanket visibility
-- into an org member's own attempts, not scoped to only
-- admin-assigned ones, for consistency with how every other
-- assessment-shaped table in this app already works. is_org_admin_of_user
-- (0016) is a plain `select exists(...)`, language sql function — no
-- multi-row select-into risk, safe to reuse directly inside this policy.
drop policy if exists "Org admins can view their members' case study exercise attempts" on public.case_study_exercise_attempts;
create policy "Org admins can view their members' case study exercise attempts"
  on public.case_study_exercise_attempts for select
  using (public.is_org_admin_of_user(user_id));
