-- Lets a tester redeem a shared code for a time-limited premium trial,
-- without needing real billing wired up yet. Expiry is a plain timestamp,
-- not enforced by a background job (no cron infra in this app) — every
-- read of subscription_tier goes through effectiveSubscriptionTier()
-- (lib/billing/subscriptionTier.ts), which treats an expired trial as
-- 'free' regardless of what's stored here, so gating stays correct without
-- needing anything to actively flip this column back.
alter table public.profiles
  add column if not exists premium_trial_expires_at timestamptz;
