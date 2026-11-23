-- ROLLBACK for migration 0213. Removes the plan-column guard and the two subscription columns (their values are lost).
-- Note: removing the guard re-opens the gap 0213 closed (a company admin could change its own seat limit, AI budget and access).
drop trigger if exists protect_organization_plan_columns on public.organizations;
drop function if exists public.trg_protect_organization_plan_columns();
alter table public.organizations drop constraint if exists organizations_subscription_status_check;
alter table public.organizations drop column if exists subscription_ends_at;
alter table public.organizations drop column if exists subscription_status;
