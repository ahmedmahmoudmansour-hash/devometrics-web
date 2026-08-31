-- 0145: Let a user see their own organization_members row directly,
-- without going through is_org_member()'s subquery
--
-- Investigated 2026-08-26 while trying to actually reproduce the org-join
-- "Company created, but joining it failed" report from 2026-08-23. Live
-- test (fresh signup, real insert sequence, cleaned up after):
--
--   insert into organizations (...) returning *              -- succeeds
--   insert into organization_members (...) returning *       -- 42501
--   insert into organization_members (...) with Prefer: return=minimal
--                                                             -- succeeds (201)
--
-- Root cause: PostgREST's default Prefer for `.insert(...)` with no
-- `.select()` chained is `return=minimal` (confirmed in
-- @supabase/postgrest-js's own source). Only `.select()` switches it to
-- `return=representation`, which makes PostgREST do INSERT ... RETURNING.
-- Under RLS, a RETURNING row must also pass the table's SELECT policy — and
-- "Members can view fellow members of their own organization" (0016) checks
-- visibility via is_org_member(organization_id), a subquery back into this
-- same table. Within a single INSERT statement's snapshot, that subquery
-- does not see the row the very same statement is in the middle of
-- inserting, so the visibility check fails and Postgres raises exactly the
-- "new row violates row-level security policy" error — indistinguishable
-- from a real WITH CHECK rejection, which is what made this look like an
-- INSERT-policy bug when it was really a RETURNING-time SELECT-policy one.
--
-- All three real INSERT call sites for this table (createOrganization,
-- joinOrganization, checkAndConsumeInvite — lib/organizations/actions.ts)
-- never chain `.select()`, so this specific failure does not affect any
-- current production code path. This migration fixes it anyway, for two
-- reasons: (1) any future `.select()` added to one of those calls — e.g.
-- to grab the new membership row's id — would hit this exact trap with no
-- obvious connection to what changed, and (2) the same is_org_member()
-- indirection pattern could reproduce this on any other table that checks
-- membership via a subquery into itself.
--
-- Fix: let a user see their OWN row via a direct user_id = auth.uid()
-- comparison, evaluated against the row itself with no subquery — which
-- has no same-statement visibility gotcha, since it isn't asking "does a
-- separate query into this table find a matching row" but "does this row I
-- already have in hand match." is_org_member() is kept for the "see my
-- colleagues" case, which never has this problem since colleague rows
-- already existed before the current statement began.
drop policy if exists "Members can view fellow members of their own organization" on public.organization_members;
create policy "Members can view fellow members of their own organization"
  on public.organization_members for select
  using (
    user_id = auth.uid()
    or public.is_org_member(organization_id)
  );
