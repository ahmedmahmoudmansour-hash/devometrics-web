-- Self-disclosed accommodation preference and resource budget tier. Both are
-- purely elective, never inferred or diagnosed — used to reshape plan
-- content and pacing, not to label the user.
alter table public.profiles
  add column if not exists accommodation text,
  add column if not exists resource_tier text;
