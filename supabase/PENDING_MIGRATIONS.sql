-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATION: 0179
--
-- Everything through 0178 is applied and verified live (2026-09-24).
--
-- 0179 -- "Tiles & features": one text[] column on organizations holding the
--        company workspace features an admin has switched off (default: none,
--        so everything stays on). Written through organizations' existing
--        is_org_admin UPDATE policy, same as the directory toggle -- no new
--        policy. Until it's applied the app degrades to "everything on".
-- ============================================================

alter table public.organizations
  add column if not exists disabled_company_features text[] not null default '{}';
