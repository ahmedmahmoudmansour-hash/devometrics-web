-- Self-service leave/delete, so test and real workspaces alike don't just
-- accumulate forever with no way to remove them. Members leave their own
-- membership; admins delete the whole workspace (cascades via the
-- on-delete-cascade FKs from 0016/0017) — no admin-transfer step, since a
-- company only has one admin in this build. Revisit if multi-admin support
-- is ever added.

create policy "Org admins can delete their own organization"
  on public.organizations for delete
  using (public.is_org_admin(id));

create policy "Users can remove their own membership"
  on public.organization_members for delete
  using (user_id = auth.uid());
