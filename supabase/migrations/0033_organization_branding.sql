-- Lets an enterprise workspace apply its own logo and accent color across
-- its members' dashboards — the "this doesn't feel like a shared pilot
-- tool" signal paying enterprise customers expect. Optional and
-- self-disclosed, same posture as every other org profile field. Reading
-- these two columns is already covered by the existing "Authenticated
-- users can look up organizations" select policy from 0016.
alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists brand_color text;

-- Also fixes a gap from 0016: organizations never had an UPDATE policy, so
-- updateOrganizationContacts (0029) would have kept failing on the RLS
-- check even once that migration's columns existed — the "missing column"
-- error seen during testing was masking this second problem underneath.
-- Scoped to admins of that specific org via the existing is_org_admin().
drop policy if exists "Org admins can update their own organization" on public.organizations;
create policy "Org admins can update their own organization"
  on public.organizations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));
