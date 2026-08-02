-- 0100: Manager visibility into direct reports' Gap Analyses
--
-- gap_analyses' only SELECT policy for a non-owner (migration 0016) is
-- "Org admins can view their members' gap analyses", gated by
-- is_org_admin_of_user(user_id) — a plain reporting-line manager who is
-- NOT an org admin has zero visibility into their own direct reports'
-- career health/competency data today. Migration 0078 closed this exact
-- gap for performance_reviews via is_manager_of_user(); this closes it for
-- gap_analyses too, needed for the new manager "Team Pulse" view.
--
-- Postgres combines multiple PERMISSIVE policies for the same command with
-- OR, so this is added as its own policy rather than rewriting 0016's —
-- both can independently grant access without either needing to know about
-- the other. is_manager_of_user is a plain `select exists(...)` (defined in
-- 0078), so it can never throw and abort this table's other policy.
drop policy if exists "Managers can view their direct reports' gap analyses" on public.gap_analyses;
create policy "Managers can view their direct reports' gap analyses"
  on public.gap_analyses for select
  using (public.is_manager_of_user(user_id));
