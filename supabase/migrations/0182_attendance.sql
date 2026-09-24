-- Attendance: one record per person per working day. Populated two ways:
--   * HR imports a spreadsheet of days (source 'import') -- the practical path
--     for companies that already track attendance in Excel or export it from a
--     fingerprint/HR system.
--   * The employee clocks themselves in/out (source 'self') through the two
--     functions below.
--
-- Times are stored as plain local `time` values, not timestamptz: an import
-- has no timezone, and a company's "9:05 check-in" means 9:05 where they work.
-- The self check-in functions take the employee's local date and time from
-- their device, so they rely on the device clock (no GPS or hardware check) and
-- refuse dates more than a day away from today.
--
-- Access: org admins manage everything; an employee reads their own days; a
-- manager reads their direct reports' days (is_manager_of_user) -- ordinary
-- team-management visibility, unlike the private employee file (0181). There
-- is no employee INSERT/UPDATE policy, so history cannot be edited by the
-- person it is about; only the two functions can write, and only for today.

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  work_date date not null,
  status text not null default 'present' check (status in ('present', 'late', 'remote', 'absent', 'holiday')),
  check_in time,
  check_out time,
  source text not null default 'import' check (source in ('import', 'self')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, work_date)
);

alter table public.attendance_records enable row level security;

drop policy if exists "Org admins manage attendance" on public.attendance_records;
create policy "Org admins manage attendance"
  on public.attendance_records for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Employees read their own attendance" on public.attendance_records;
create policy "Employees read their own attendance"
  on public.attendance_records for select
  using (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "Managers read their reports attendance" on public.attendance_records;
create policy "Managers read their reports attendance"
  on public.attendance_records for select
  using (public.is_manager_of_user(user_id) and public.is_org_member(organization_id));

create index if not exists attendance_records_org_date_idx on public.attendance_records (organization_id, work_date desc);
create index if not exists attendance_records_user_date_idx on public.attendance_records (user_id, work_date desc);

-- Clock in for a day (the employee's local date/time). Creates the day's
-- record, or fills in the check-in of an existing one that has none yet.
-- Never overwrites a check-in that is already there.
create or replace function public.attendance_check_in(p_work_date date, p_time time)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if p_work_date is null or p_time is null then
    raise exception 'Date and time are required';
  end if;
  if abs(p_work_date - current_date) > 1 then
    raise exception 'Date is too far from today';
  end if;

  select om.organization_id into v_org
  from public.organization_members om
  where om.user_id = auth.uid()
    and coalesce(om.employment_status, 'active') = 'active'
  limit 1;
  if v_org is null then
    raise exception 'Not a member of a company workspace';
  end if;

  insert into public.attendance_records as ar (organization_id, user_id, work_date, status, check_in, source, created_by)
  values (v_org, auth.uid(), p_work_date, 'present', p_time, 'self', auth.uid())
  on conflict (organization_id, user_id, work_date) do update
    set check_in = coalesce(ar.check_in, excluded.check_in)
    where ar.check_in is null;
  return true;
end;
$$;

-- Clock out. Only against a day the caller already has a check-in for, and
-- never earlier than that check-in.
create or replace function public.attendance_check_out(p_work_date date, p_time time)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_work_date is null or p_time is null then
    raise exception 'Date and time are required';
  end if;
  if abs(p_work_date - current_date) > 1 then
    raise exception 'Date is too far from today';
  end if;

  update public.attendance_records ar
  set check_out = p_time
  where ar.user_id = auth.uid()
    and ar.work_date = p_work_date
    and ar.check_in is not null
    and p_time >= ar.check_in;
  if not found then
    raise exception 'No check-in found for that day';
  end if;
  return true;
end;
$$;

revoke all on function public.attendance_check_in(date, time) from public;
grant execute on function public.attendance_check_in(date, time) to authenticated;
revoke all on function public.attendance_check_out(date, time) from public;
grant execute on function public.attendance_check_out(date, time) to authenticated;
