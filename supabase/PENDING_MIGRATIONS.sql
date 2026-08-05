-- ============================================================
-- DEVOMETRICS — PENDING MIGRATIONS IN ONE PASTE
-- 0089 through 0110 confirmed applied. Three remain, run in order:
--
-- 0111: Lets a platform admin (profiles.is_admin = true) schedule data
-- deletion for ANY user across the whole platform — the existing
-- admin_schedule_employee_data_deletion (0066) only works when the caller
-- is that specific employee's own org admin.
--
-- 0112: Adds profiles.is_disabled (block/restore a user's login+use of the
-- app without touching their data) and extends 0092's self-escalation
-- guard to cover it, so a disabled user can't just flip their own flag
-- back via a direct client update.
--
-- 0113: Org-level equivalent of 0112 — organizations.is_disabled blocks
-- every member of a company workspace at once, since Enterprise has no
-- "free" fallback tier to downgrade a lapsed payment into the way
-- individual accounts do.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run.
-- ============================================================

-- 0111: Platform-admin-triggered data deletion (any user, not just an org's
-- own employees)
--
-- admin_schedule_employee_data_deletion (migration 0066) only works when
-- the caller is the target's own org admin (is_org_admin_of_user) — it
-- can't be used by a platform admin (profiles.is_admin = true) to schedule
-- deletion for an arbitrary user across the whole platform, e.g. cleaning
-- up a test/demo account or an individual user with no organization at
-- all. This mirrors 0066's pair of functions exactly, just gated on the
-- caller's own is_admin flag instead of org-admin-of-user — same
-- SECURITY DEFINER, narrowly-scoped-to-one-column approach (not a blanket
-- RLS UPDATE policy on profiles), same underlying pending_data_deletion_at
-- column and daily purge cron (migration 0059) as every other path into
-- this same deletion mechanism.

create or replace function public.platform_admin_schedule_data_deletion(target_user_id uuid, grace_days int default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  deletion_at timestamptz;
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  deletion_at := now() + (grace_days || ' days')::interval;
  update public.profiles set pending_data_deletion_at = deletion_at where id = target_user_id;

  return deletion_at;
end;
$$;

revoke all on function public.platform_admin_schedule_data_deletion(uuid, int) from public;
grant execute on function public.platform_admin_schedule_data_deletion(uuid, int) to authenticated;

create or replace function public.platform_admin_cancel_data_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  update public.profiles set pending_data_deletion_at = null where id = target_user_id;
end;
$$;

revoke all on function public.platform_admin_cancel_data_deletion(uuid) from public;
grant execute on function public.platform_admin_cancel_data_deletion(uuid) to authenticated;

-- 0112: Let a platform admin disable a user's access (in addition to the
-- existing "wipe their data" mechanism from 0111) — separate concepts:
-- disabling blocks login/use of the app without touching any of their
-- content, wiping data does the opposite (keeps the login, clears the
-- content). Both are meant to be used independently or together.
--
-- is_disabled updates go through the existing "Platform admins can update
-- any profile" RLS policy (migration 0091) — no new SECURITY DEFINER
-- function needed for the toggle itself, same as subscription_tier and
-- monthly_ai_budget_usd already do. The one thing that DOES need updating
-- is 0092's self-escalation guard: without adding is_disabled to it, a
-- disabled user could simply flip their own flag back to false via a
-- direct client update, defeating the whole feature.

alter table public.profiles
  add column if not exists is_disabled boolean not null default false;

-- Signature is changing (5 params instead of 4), so this needs a drop
-- first — `create or replace` can't change a function's parameter list.
drop function if exists public.profile_admin_fields_unchanged(uuid, boolean, text, timestamptz, numeric);

create or replace function public.profile_admin_fields_unchanged(
  target_user_id uuid,
  new_is_admin boolean,
  new_subscription_tier text,
  new_premium_trial_expires_at timestamptz,
  new_monthly_ai_budget_usd numeric,
  new_is_disabled boolean
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = target_user_id
        and new_is_admin is not distinct from p.is_admin
        and new_subscription_tier is not distinct from p.subscription_tier
        and new_premium_trial_expires_at is not distinct from p.premium_trial_expires_at
        and new_monthly_ai_budget_usd is not distinct from p.monthly_ai_budget_usd
        and new_is_disabled is not distinct from p.is_disabled
    );
$$;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_admin_fields_unchanged(
      id, is_admin, subscription_tier, premium_trial_expires_at, monthly_ai_budget_usd, is_disabled
    )
  );

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
