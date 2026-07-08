-- The Lemon Squeezy webhook has no Supabase auth session (it's a server-to-
-- server POST from Lemon Squeezy, not a logged-in user), so a plain
-- `.update()` against profiles would silently affect zero rows under RLS —
-- there's no auth.uid() for the policy to match. This app has no
-- service-role key by design, so the fix is the same pattern already used
-- for is_org_admin() etc.: a security-definer function that bypasses RLS
-- internally. The safety boundary here is NOT auth.uid() — it's that the
-- webhook route already verified the Lemon Squeezy HMAC signature before
-- ever calling this function. Do not widen the general profiles UPDATE
-- policy to work around this instead.
create or replace function public.set_subscription_tier(p_user_id uuid, p_tier text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set subscription_tier = p_tier
  where id = p_user_id
    and p_tier in ('free', 'premium', 'enterprise');
$$;
