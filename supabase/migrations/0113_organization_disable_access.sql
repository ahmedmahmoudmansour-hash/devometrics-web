-- 0113: Org-level equivalent of 0112's profiles.is_disabled
--
-- Enterprise has no "free" fallback tier (it's Custom/sales-priced, no
-- self-serve downgrade path — confirmed against the pricing page copy),
-- so a lapsed enterprise payment can't be handled the same way the
-- individual LemonSqueezy webhook handles it (downgrade to free). The
-- only sensible failure mode for a company account is blocking the whole
-- workspace, not one person — disabling a single admin's profile
-- (migration 0112) wouldn't lock out the rest of the company.
--
-- Goes through the existing "Platform admins can update organizations"
-- policy (migration 0079, no column restrictions) — same pattern as
-- seat_limit and monthly_ai_budget_usd already use, no new SECURITY
-- DEFINER function needed.
--
-- Deliberately manual-only for now, not wired to any billing webhook —
-- enterprise deals are sold via "Talk to sales" (custom/invoiced), not a
-- self-serve subscription with lifecycle events to react to.

alter table public.organizations
  add column if not exists is_disabled boolean not null default false;
