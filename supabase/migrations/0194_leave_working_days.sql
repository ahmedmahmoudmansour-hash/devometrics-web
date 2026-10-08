-- 0194 -- Leave days are counted by the system, from the company's weekend and
-- public-holiday calendar (pre-rollout audit 2026-10-08, CONFIRMED live: the
-- number of days on a request was whatever the employee typed, so a 31-day
-- range could be stored as 1 day). 0191 stopped overstating; this stops the
-- number being typed at all.
--
-- 1. organizations.weekend_days -- ISO weekday numbers (1 = Monday ... 7 =
--    Sunday). Default {5,6} (Friday + Saturday); each company changes it.
-- 2. public_holidays -- dates the company's admins add (members can see them).
-- 3. count_leave_days(org, start, end) -- weekdays in the range that are neither
--    a weekend day nor a holiday.
-- 4. A BEFORE trigger on leave_requests sets days_requested from that count for
--    every request that is PENDING (an employee's request awaiting a decision):
--      - a request made only of weekend days / holidays is refused;
--      - a single working day may be requested as a half day (0.5);
--      - ranges longer than 366 days are refused.
--    Requests inserted by HR already approved/decided (logging leave after the
--    fact, spreadsheet imports) are NOT recalculated -- HR's figure stands, as
--    it did before; 0191's range check still applies to them.
--    Existing pending requests are untouched until edited.
--
-- Not changed: no balance check (HR may legitimately approve beyond a balance);
-- a request that spans New Year is still booked to its start year.
--
-- Depends on 0166 (leave_requests), 0191 (days_within_range check), 0190
-- (private-by-default function privileges).

alter table public.organizations
  add column if not exists weekend_days smallint[] not null default '{5,6}';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_weekend_days_valid'
  ) then
    alter table public.organizations
      add constraint organizations_weekend_days_valid
      check (weekend_days <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(weekend_days) <= 6);
  end if;
end $$;

create table if not exists public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  holiday_date date not null,
  name text not null check (char_length(name) between 1 and 100),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, holiday_date)
);

alter table public.public_holidays enable row level security;

drop policy if exists "Org members can view public holidays" on public.public_holidays;
create policy "Org members can view public holidays"
  on public.public_holidays for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins manage public holidays" on public.public_holidays;
create policy "Org admins manage public holidays"
  on public.public_holidays for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists public_holidays_org_idx on public.public_holidays (organization_id, holiday_date);

create or replace function public.count_leave_days(p_organization_id uuid, p_start date, p_end date)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::numeric
  from generate_series(p_start, p_end, interval '1 day') as d
  where not (extract(isodow from d)::smallint = any (
          coalesce((select o.weekend_days from public.organizations o where o.id = p_organization_id), '{5,6}'::smallint[])
        ))
    and not exists (
      select 1 from public.public_holidays h
      where h.organization_id = p_organization_id and h.holiday_date = d::date
    );
$$;

create or replace function public.trg_leave_requests_compute_days()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days numeric;
begin
  -- Only a request awaiting a decision is counted by the system.
  if new.status is distinct from 'pending' then
    return new;
  end if;

  if (new.end_date - new.start_date) > 366 then
    raise exception 'A leave request can span at most 366 days';
  end if;

  v_days := public.count_leave_days(new.organization_id, new.start_date, new.end_date);
  if v_days = 0 then
    raise exception 'The selected dates are all weekends or public holidays';
  end if;

  -- A single working day may be taken as a half day.
  if v_days = 1 and new.days_requested = 0.5 then
    return new;
  end if;

  new.days_requested := v_days;
  return new;
end;
$$;

drop trigger if exists leave_requests_compute_days on public.leave_requests;
create trigger leave_requests_compute_days
  before insert or update of start_date, end_date, days_requested, status on public.leave_requests
  for each row execute function public.trg_leave_requests_compute_days();
