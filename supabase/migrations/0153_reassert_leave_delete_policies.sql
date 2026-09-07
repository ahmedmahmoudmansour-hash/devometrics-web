-- Real bug found while cleaning up test data: self-service "Leave company"
-- (lib/organizations/actions.ts's leaveOrganization) and org-admin "Delete
-- company workspace" both report success with no error, but the underlying
-- delete silently affects zero rows — confirmed directly against
-- production via the anon-key client (not a hypothesis): a DELETE on
-- organization_members for a user's own row, and a DELETE on organizations
-- by its own confirmed admin (is_org_admin() independently verified to
-- return true for that call), both returned HTTP 200 with an empty result
-- and no error. That's the exact signature of an RLS policy silently not
-- matching — not a foreign-key block (which would raise a real error) and
-- not a broken admin-check function (verified working on its own).
--
-- The two policies these actions depend on (migration 0018) show correctly
-- in the migration history, but this project's migrations are applied by
-- hand-pasting SQL into the Supabase SQL Editor rather than through a
-- tracked migration runner — so the live database's actual policy state
-- can drift from what's checked into this repo without anything catching
-- it. Rather than guess further without direct pg_policies access (no
-- service-role key in this app, by design), this migration forces both
-- policies back to their intended definition: drop-if-exists, then
-- recreate, so this is safe to run regardless of whatever state they're
-- actually in on the live database right now.

drop policy if exists "Users can remove their own membership" on public.organization_members;
create policy "Users can remove their own membership"
  on public.organization_members for delete
  using (user_id = auth.uid());

drop policy if exists "Org admins can delete their own organization" on public.organizations;
create policy "Org admins can delete their own organization"
  on public.organizations for delete
  using (public.is_org_admin(id));
