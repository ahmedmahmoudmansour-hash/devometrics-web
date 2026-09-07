-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0153
--
-- Everything through 0152 has been confirmed applied AND behaviorally
-- verified live (2026-09-04): the org-member assignment picker RPC and the
-- atomic survey-edit-guard RPC both work exactly as designed against real
-- test accounts.
--
-- 0153 — Real bug found while cleaning up that same test data: self-service
--        "Leave company" and org-admin "Delete company workspace" both
--        report success with no error, but silently affect zero rows.
--        Confirmed directly (not a guess): is_org_admin() independently
--        verified to return true for the calling admin, ruling out the
--        admin-check function; the DELETE itself returns HTTP 200 with an
--        empty result and no error — the exact signature of an RLS policy
--        silently not matching, not a foreign-key block. The two policies
--        involved (migration 0018) look correct in this repo's history,
--        but migrations here are applied by hand-pasting SQL rather than a
--        tracked runner, so the live database's actual policy state can
--        drift from what's checked in without anything catching it. This
--        migration force-reasserts both policies (drop-if-exists, then
--        recreate) regardless of whatever state they're actually in live.
--        Idempotent, safe to run any time.
-- ============================================================

drop policy if exists "Users can remove their own membership" on public.organization_members;
create policy "Users can remove their own membership"
  on public.organization_members for delete
  using (user_id = auth.uid());

drop policy if exists "Org admins can delete their own organization" on public.organizations;
create policy "Org admins can delete their own organization"
  on public.organizations for delete
  using (public.is_org_admin(id));
