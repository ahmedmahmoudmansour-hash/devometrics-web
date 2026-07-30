-- ============================================================
-- 0093: Per-employee AI spend breakdown, platform-admin only
-- ============================================================
-- org_ai_spend_this_month (0090) deliberately has no admin gate — it's a
-- single scalar sum any org member can call to check "can I proceed", not
-- sensitive on its own. A PER-EMPLOYEE breakdown is different: it reveals
-- individual usage patterns, which should only ever be visible to the
-- platform's own super-admin backend view (/dashboard/admin), never to a
-- company's own org-admin or its employees — per explicit product
-- decision, customers should only ever see an abstracted "credit" concept,
-- never real dollar figures or a colleague's usage. This function is
-- gated by is_admin() internally (not just by the calling UI), so it
-- returns zero rows for anyone who isn't a platform admin, regardless of
-- what eventually calls it.

create or replace function public.org_member_ai_spend_this_month(target_org_id uuid)
returns table(user_id uuid, cost_usd numeric)
language sql
security definer
set search_path = public
stable
as $$
  select e.user_id, coalesce(sum(e.cost_usd), 0) as cost_usd
  from public.ai_usage_events e
  where e.organization_id = target_org_id
    and e.created_at >= date_trunc('month', now())
    and e.user_id is not null
    and public.is_admin()
  group by e.user_id;
$$;
