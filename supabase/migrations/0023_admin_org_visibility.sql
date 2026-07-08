-- The flat pilot-tracking admin view (is_admin(), see 0013) could see every
-- participant's individual data, but had no visibility into which company
-- workspace (if any) each participant belonged to — organization_members'
-- only SELECT policy was "members of that same org," which a platform admin
-- who isn't personally a member of every org doesn't satisfy. This grants
-- the same "sees everything for pilot tracking" read as the other 0013
-- policies, scoped to this one additional table.
create policy "Platform admins can view all organization memberships"
  on public.organization_members for select
  using (public.is_admin());
