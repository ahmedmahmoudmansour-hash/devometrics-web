-- Deliberately named "subscription_tier", not "tier" or "resource_tier" —
-- there's already an unrelated "resource_tier" field on profiles (the
-- user's own stated learning-resource budget preference, e.g. "Free & open
-- resources only"). This is a completely different thing: which paid plan
-- the person is actually on. Defaults to 'free' for everyone until real
-- billing (Lemon Squeezy) writes to this field.
alter table public.profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'premium', 'enterprise'));
