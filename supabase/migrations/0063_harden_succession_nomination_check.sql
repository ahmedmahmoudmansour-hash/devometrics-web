-- The insert-time check for succession_nominations only verified the
-- admin owns the role, not that the nominated employee actually belongs
-- to that same organization. The app layer already blocks this
-- (nominateForRole checks org membership before inserting), but a direct
-- Supabase REST call bypassing the app could otherwise create a
-- nomination row pointing at an arbitrary user id outside the org.
-- Defense in depth, not a data-leak fix — no other table's data was ever
-- reachable through this policy either way.
drop policy if exists "Org admins manage succession nominations" on public.succession_nominations;
create policy "Org admins manage succession nominations"
  on public.succession_nominations for all
  using (
    exists (
      select 1 from public.succession_roles sr
      where sr.id = role_id and public.is_org_admin(sr.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.succession_roles sr
      join public.organization_members om
        on om.organization_id = sr.organization_id and om.user_id = employee_user_id
      where sr.id = role_id and public.is_org_admin(sr.organization_id)
    )
  );
