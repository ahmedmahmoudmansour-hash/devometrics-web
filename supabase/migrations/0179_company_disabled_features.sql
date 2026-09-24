-- "Tiles & features": an org admin can switch off whole areas (or single
-- features) of the company workspace they don't use, so the hub and nav
-- only show what the company actually runs. Stored as a plain list of
-- feature keys on organizations (deny-list, like organization_feature_
-- restrictions: default is everything on). Written by org admins through
-- organizations' existing is_org_admin UPDATE policy -- the same path the
-- directory and manager-visibility toggles already use -- so no new policy.
-- Keys are validated in the app (lib/organizations/companyTiles.ts); the
-- database only guarantees it's a text array.
--
-- Switching off a feature that has an employee-facing counterpart (Knowledge
-- Hub, Job Architecture, Competencies, Performance Reviews) is enforced for
-- employees too, by feeding it into the existing per-feature restriction
-- gates in the app -- not a second permission system.
alter table public.organizations
  add column if not exists disabled_company_features text[] not null default '{}';
