-- Self-disclosed language preference (en/ar), same pattern as theme (0011):
-- a plain nullable text column with a sensible default, no enum/check
-- constraint. Persisted so a logged-in user's language choice follows them
-- across devices — the live source of truth for rendering is the
-- devometrics-locale cookie (see lib/i18n/request.ts), this column is the
-- cross-device sync backup, same relationship theme has with the
-- devometrics-theme localStorage key.
alter table public.profiles
  add column if not exists language text default 'en';
