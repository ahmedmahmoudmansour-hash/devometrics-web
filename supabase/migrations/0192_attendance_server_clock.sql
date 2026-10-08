-- 0192 -- Attendance: the server's clock, in the company's timezone, decides
-- when someone clocked in or out (pre-rollout audit 2026-10-08, CONFIRMED
-- live: an employee could clock in at any time they typed, for today or
-- yesterday -- the database stored the date and time the device sent).
--
-- 1. organizations.timezone (default 'Africa/Cairo', each company changes it
--    in Settings). A trigger rejects a name Postgres doesn't know (a CHECK
--    can't query pg_timezone_names).
-- 2. attendance_check_in / attendance_check_out now IGNORE the date and time
--    arguments and use now() converted to the company's timezone. The
--    parameters stay (now with defaults, so callers can omit them) rather than
--    changing the signature: a second overload next to the old one is exactly
--    what broke propose_compensation_change in 0165 -- PostgREST can't choose
--    between them. Anything that still passes a time simply has it ignored.
-- 3. Clock-out finds the caller's own open day (clocked in, not out) from
--    today or yesterday, so a night shift can clock out after midnight; it
--    refuses to clock out earlier than the check-in on the same day.
--
-- Not changed: HR can still correct or import records (those are the "import"
-- source, shown as such); a fingerprint/door device would be a separate
-- trusted integration.
--
-- Depends on 0182 (attendance_records), 0190 (function grants -- this file
-- re-grants nothing: create or replace keeps the existing grants).

alter table public.organizations
  add column if not exists timezone text not null default 'Africa/Cairo';

create or replace function public.trg_validate_org_timezone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_validate_timezone on public.organizations;
create trigger organizations_validate_timezone
  before insert or update of timezone on public.organizations
  for each row execute function public.trg_validate_org_timezone();

create or replace function public.attendance_check_in(p_work_date date default null, p_time time default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_tz text;
  v_local timestamp;
begin
  select om.organization_id into v_org
  from public.organization_members om
  where om.user_id = auth.uid()
    and coalesce(om.employment_status, 'active') = 'active'
  limit 1;
  if v_org is null then
    raise exception 'Not a member of a company workspace';
  end if;

  select coalesce(o.timezone, 'UTC') into v_tz from public.organizations o where o.id = v_org limit 1;
  v_local := now() at time zone coalesce(v_tz, 'UTC');

  insert into public.attendance_records as ar (organization_id, user_id, work_date, status, check_in, source, created_by)
  values (v_org, auth.uid(), v_local::date, 'present', date_trunc('minute', v_local)::time, 'self', auth.uid())
  on conflict (organization_id, user_id, work_date) do update
    set check_in = coalesce(ar.check_in, excluded.check_in)
    where ar.check_in is null;
  return true;
end;
$$;

create or replace function public.attendance_check_out(p_work_date date default null, p_time time default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_tz text;
  v_local timestamp;
  v_id uuid;
begin
  select om.organization_id into v_org
  from public.organization_members om
  where om.user_id = auth.uid()
    and coalesce(om.employment_status, 'active') = 'active'
  limit 1;
  if v_org is null then
    raise exception 'Not a member of a company workspace';
  end if;

  select coalesce(o.timezone, 'UTC') into v_tz from public.organizations o where o.id = v_org limit 1;
  v_local := now() at time zone coalesce(v_tz, 'UTC');

  -- The caller's most recent open day (in, not yet out) from today or yesterday.
  select ar.id into v_id
  from public.attendance_records ar
  where ar.user_id = auth.uid()
    and ar.organization_id = v_org
    and ar.check_in is not null
    and ar.check_out is null
    and ar.work_date >= v_local::date - 1
    and ar.work_date <= v_local::date
    -- same day: never earlier than the check-in; yesterday's open day: any time now is later
    and (ar.work_date < v_local::date or date_trunc('minute', v_local)::time >= ar.check_in)
  order by ar.work_date desc
  limit 1;

  if v_id is null then
    raise exception 'No check-in found for that day';
  end if;

  update public.attendance_records set check_out = date_trunc('minute', v_local)::time where id = v_id;
  return true;
end;
$$;
