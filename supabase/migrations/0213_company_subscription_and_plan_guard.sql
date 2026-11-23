-- 0213: a company subscription (trial / active / expired, with an end date), and a guard so a company cannot change its own plan.
--
-- Part 1, the gap this closes: "Org admins can update their own organization" (0033) allows an UPDATE of ANY column of their own company
-- row, and the only column guard on organizations (0164) covers ownership. So a company admin could, through the API with their own login,
-- lift their own seat_limit, clear their own monthly_ai_budget_usd, or switch is_disabled back off. Those are Devometrics' controls, set
-- by platform staff, and the database must enforce that, not the screens.
--
-- Guard: a BEFORE UPDATE trigger refuses a change to any plan column unless the caller is a platform admin (is_admin(), 0013), or the
-- statement is not coming through the API at all (the owner in the Supabase SQL editor runs as postgres, not anon/authenticated).
-- Every other column stays exactly as editable as before.
--
-- Part 2: subscription_status ('trial' | 'active' | 'expired') and subscription_ends_at. Every existing company becomes 'active' with no
-- end date, so nothing running today changes. A company is "lapsed" when it is 'expired', or its end date has passed. The app then sends
-- its people to a "subscription ended" page; no data is changed or deleted. Renewing = set it back to 'active' (or a later end date).
--
-- Safe to run more than once. Adds two columns (with defaults), one function, one trigger. Changes no existing row's data.
-- To undo: run supabase/ROLLBACK_0213.sql.

alter table public.organizations
  add column if not exists subscription_status text not null default 'active',
  add column if not exists subscription_ends_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_subscription_status_check') then
    alter table public.organizations
      add constraint organizations_subscription_status_check check (subscription_status in ('trial', 'active', 'expired'));
  end if;
end;
$$;

create or replace function public.trg_protect_organization_plan_columns()
returns trigger
language plpgsql
-- Deliberately NOT security definer: inside a definer function current_user is the function's owner, so the caller check below would
-- never fire. Run as the caller, current_user is anon/authenticated through the API and postgres in the SQL editor.
security invoker
set search_path = public
as $$
begin
  if (
    new.seat_limit is distinct from old.seat_limit
    or new.monthly_ai_budget_usd is distinct from old.monthly_ai_budget_usd
    or new.is_disabled is distinct from old.is_disabled
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_ends_at is distinct from old.subscription_ends_at
  )
  and current_user in ('anon', 'authenticated')
  and not coalesce(public.is_admin(), false) then
    raise exception 'A company''s plan (seats, AI budget, subscription, access) can only be changed by Devometrics';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_plan_columns on public.organizations;
create trigger protect_organization_plan_columns
  before update on public.organizations
  for each row execute function public.trg_protect_organization_plan_columns();
