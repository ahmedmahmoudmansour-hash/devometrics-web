-- Lets a free-tier user permanently hide the Upgrade/trial/student-discount
-- cluster from their home dashboard instead of seeing the same pitch on
-- every visit forever. Same simple boolean-flag pattern as badges_enabled
-- (0032-era) — no new table needed for a single per-user preference.
alter table public.profiles
  add column if not exists upgrade_prompt_dismissed boolean not null default false;
