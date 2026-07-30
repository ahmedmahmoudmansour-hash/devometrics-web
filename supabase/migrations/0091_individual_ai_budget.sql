-- ============================================================
-- 0091: Individual (non-org) AI budget enforcement
-- ============================================================

-- Mirrors organizations.monthly_ai_budget_usd (0090) on profiles, same
-- null-means-unlimited convention — assertOrgAiBudgetOk (now
-- assertAiBudgetOk, lib/aiUsage/track.ts) previously no-op'd unconditionally
-- for any account with no organization_id, meaning solo/individual users
-- had zero AI spend enforcement.
alter table public.profiles
  add column if not exists monthly_ai_budget_usd numeric(10,2);

-- Scalar aggregate (coalesce(sum(...),0) always returns exactly one row) —
-- same posture as org_ai_spend_this_month (0090); the 0083 postmortem
-- guard is for plpgsql multi-row select-into, which this isn't.
-- organization_id is null matters: an org member's personal (non-org)
-- spend must never be confused with their org's pooled spend.
create or replace function public.user_ai_spend_this_month(target_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage_events
  where user_id = target_user_id
    and organization_id is null
    and created_at >= date_trunc('month', now());
$$;

-- Closes a real gap the new column would otherwise open: profiles' only
-- self-update policy (0001_init.sql) is a blanket `auth.uid() = id` with no
-- `with check` clause at all, so without this a user could set their own
-- budget directly via the API, bypassing platform-admin control entirely.
-- Single PK-keyed scalar subquery — no multi-row select-into risk, so no
-- exception guard needed (same reasoning as the function above).
create or replace function public.profile_budget_change_allowed(target_user_id uuid, new_budget numeric)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or new_budget is not distinct from (
      select monthly_ai_budget_usd from public.profiles where id = target_user_id
    );
$$;

-- Redefines 0001_init.sql's policy of the same name to add the budget
-- restriction. Any other column update (full_name, career_stage, etc.)
-- still passes: an update statement that doesn't touch
-- monthly_ai_budget_usd leaves NEW.monthly_ai_budget_usd equal to the
-- stored value, which profile_budget_change_allowed treats as unchanged.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_budget_change_allowed(id, monthly_ai_budget_usd)
  );

-- profiles never had an admin WRITE policy before (0013's admin policy was
-- read-only: "Admins can view all profiles") — this is the first one, same
-- posture as 0079's equivalent grant on organizations.
drop policy if exists "Platform admins can update any profile" on public.profiles;
create policy "Platform admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());
