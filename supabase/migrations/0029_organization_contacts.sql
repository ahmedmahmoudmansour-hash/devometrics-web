-- Enterprise account setup needs named contacts beyond just the admin who
-- signed up — a platform contact (day-to-day usage/support) and a finance
-- contact (billing), matching real B2B onboarding conventions. Optional and
-- self-disclosed, same posture as every other org profile field.
alter table public.organizations
  add column if not exists platform_contact_name text,
  add column if not exists platform_contact_email text,
  add column if not exists finance_contact_name text,
  add column if not exists finance_contact_email text;
