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

-- The self-update policy itself must be dropped before the function it
-- depends on can be — Postgres refuses to drop a function a live policy
-- still references, `if exists` or not. Recreated at the bottom of this
-- file once the new 6-param function exists.
drop policy if exists "Users can update their own profile" on public.profiles;

-- Signature is changing (6 params instead of 5), so this needs a drop
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

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_admin_fields_unchanged(
      id, is_admin, subscription_tier, premium_trial_expires_at, monthly_ai_budget_usd, is_disabled
    )
  );
