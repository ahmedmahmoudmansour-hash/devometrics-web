-- ============================================================
-- 0092: Close self-escalation gap on profiles admin-controlled fields
-- ============================================================
-- 0091 added a `with check` to the profiles self-update policy, but it only
-- guarded monthly_ai_budget_usd. is_admin, subscription_tier, and
-- premium_trial_expires_at were left completely open — any authenticated
-- user could grant themselves platform admin or premium via a direct
-- client update (e.g. supabase.from('profiles').update({is_admin: true})),
-- bypassing both the documented "hand-flagged via SQL editor" admin
-- process (0013) and real billing entirely. This broadens the check to
-- cover all four admin-controlled columns with one helper, replacing
-- profile_budget_change_allowed.

create or replace function public.profile_admin_fields_unchanged(
  target_user_id uuid,
  new_is_admin boolean,
  new_subscription_tier text,
  new_premium_trial_expires_at timestamptz,
  new_monthly_ai_budget_usd numeric
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
    );
$$;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_admin_fields_unchanged(
      id, is_admin, subscription_tier, premium_trial_expires_at, monthly_ai_budget_usd
    )
  );
