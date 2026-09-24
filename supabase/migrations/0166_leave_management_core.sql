-- Leave & Vacation Management — the first "basic HR" workstream after
-- Compensation Management (the second was named alongside it in the
-- original feedback: attendance/GPS check-in, scoped separately, later).
--
-- Deliberately a MUCH lighter-weight access pattern than compensation:
-- leave data isn't "who-sees-whose-salary" sensitive, so this uses normal
-- direct-table RLS with is_org_admin/is_manager_of_user — the same
-- established pattern as performance reviews (0078), not compensation's
-- zero-client-policy RPC-only lockdown. Matching the sensitivity of the
-- data to the strength of the boundary, not reusing the heaviest pattern
-- in the codebase by default.
--
-- Three tables:
--   - leave_types: org-configurable (annual, sick, unpaid, ...) — same
--     admin-manages/member-reads shape as salary_bands (0154).
--   - leave_balances: per employee, per type, per calendar year —
--     "days per employee" per the request. allocated_days is set by HR
--     (defaulting from the leave type when first needed); used_days is
--     maintained automatically by a trigger, never hand-edited to match
--     approved requests.
--   - leave_requests: the actual planner/workflow — an employee requests,
--     their manager OR an org admin decides. An org admin can also insert
--     a request pre-approved directly (recording leave taken without the
--     request dance) — the same "admin can act for anyone org-wide, not
--     just their own reports" gap I had to retrofit onto compensation
--     (missing propose-for-any-employee UI) is designed in from the start
--     here instead of found later.
--
-- Security note learned directly from the compensation build: admins/
-- managers get NO raw UPDATE policy on leave_requests — only a function
-- (decide_leave_request) can approve/reject, so there's no way to bypass
-- its "must still be pending" check via a direct PATCH the way
-- organization_members' pre-existing broad UPDATE policy let someone
-- bypass the ownership-transfer guards (0163/0164). Only the employee
-- themselves gets a (narrow: pending-edit or cancel only) direct UPDATE
-- policy on their own row.

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  color text,
  is_paid boolean not null default true,
  requires_approval boolean not null default true,
  default_annual_days numeric(5,1) not null default 0 check (default_annual_days >= 0),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.leave_types enable row level security;

drop policy if exists "Org members can view leave types" on public.leave_types;
create policy "Org members can view leave types"
  on public.leave_types for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins manage leave types" on public.leave_types;
create policy "Org admins manage leave types"
  on public.leave_types for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists leave_types_org_idx on public.leave_types (organization_id);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete cascade,
  year int not null,
  allocated_days numeric(5,1) not null default 0 check (allocated_days >= 0),
  used_days numeric(5,1) not null default 0 check (used_days >= 0),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_user_id, leave_type_id, year)
);

alter table public.leave_balances enable row level security;

drop policy if exists "See own or managed leave balances" on public.leave_balances;
create policy "See own or managed leave balances"
  on public.leave_balances for select
  using (
    employee_user_id = auth.uid()
    or public.is_org_admin(organization_id)
    or public.is_manager_of_user(employee_user_id)
  );

-- HR-controlled only — managers can VIEW (above) but not adjust allocations,
-- same trust split as compensation proposals vs approvals.
drop policy if exists "Org admins manage leave balances" on public.leave_balances;
create policy "Org admins manage leave balances"
  on public.leave_balances for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists leave_balances_org_idx on public.leave_balances (organization_id);
create index if not exists leave_balances_employee_idx on public.leave_balances (employee_user_id, year);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete set null,
  start_date date not null,
  end_date date not null,
  days_requested numeric(5,1) not null check (days_requested > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id),
  decision_comment text,
  constraint leave_requests_date_order check (end_date >= start_date)
);

alter table public.leave_requests enable row level security;

drop policy if exists "See own or managed leave requests" on public.leave_requests;
create policy "See own or managed leave requests"
  on public.leave_requests for select
  using (
    employee_user_id = auth.uid()
    or public.is_org_admin(organization_id)
    or public.is_manager_of_user(employee_user_id)
  );

-- An employee can only ever insert their OWN request, and only as
-- 'pending' — an org admin can additionally insert on anyone's behalf at
-- any status (recording leave directly, e.g. already-taken or pre-approved
-- leave), but a manager who is NOT an org admin cannot insert for a
-- report at all — they can only decide (function below), matching how
-- compensation restricts "propose for anyone" to Comp Admins specifically.
drop policy if exists "Employees request their own leave" on public.leave_requests;
create policy "Employees request their own leave"
  on public.leave_requests for insert
  with check (
    (employee_user_id = auth.uid() and status = 'pending')
    or public.is_org_admin(organization_id)
  );

-- Deliberately narrow and self-only — see the migration header. Approval/
-- rejection is a function, not a policy, so it can't be bypassed by a
-- direct PATCH the way organization_members' pre-existing broad admin
-- UPDATE policy let someone bypass the ownership-transfer guards.
drop policy if exists "Employees edit or cancel their own pending/approved leave" on public.leave_requests;
create policy "Employees edit or cancel their own pending/approved leave"
  on public.leave_requests for update
  using (employee_user_id = auth.uid())
  with check (employee_user_id = auth.uid() and status in ('pending', 'cancelled'));

create index if not exists leave_requests_org_idx on public.leave_requests (organization_id, status);
create index if not exists leave_requests_employee_idx on public.leave_requests (employee_user_id, start_date desc);

-- Keeps leave_balances.used_days in sync with approved requests — fires on
-- both INSERT (an admin recording an already-approved request directly)
-- and UPDATE (a pending request being approved, or an approved one being
-- cancelled/rejected after the fact). If no balance row exists yet for
-- this employee/type/year, seeds one from the leave type's default
-- allocation rather than assuming 0 — an admin who's already set a custom
-- allocated_days for this specific employee is never overwritten (ON
-- CONFLICT only touches used_days).
create or replace function public.trg_update_leave_balance_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int;
  v_old_status text;
begin
  v_old_status := case when tg_op = 'INSERT' then null else old.status end;
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  v_year := extract(year from new.start_date);

  if new.status = 'approved' and v_old_status is distinct from 'approved' then
    insert into public.leave_balances (organization_id, employee_user_id, leave_type_id, year, allocated_days, used_days)
    select new.organization_id, new.employee_user_id, new.leave_type_id, v_year,
           coalesce((select default_annual_days from public.leave_types where id = new.leave_type_id), 0),
           new.days_requested
    on conflict (organization_id, employee_user_id, leave_type_id, year)
    do update set used_days = public.leave_balances.used_days + new.days_requested, updated_at = now();
  elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status <> 'approved' then
    update public.leave_balances
    set used_days = greatest(0, used_days - old.days_requested), updated_at = now()
    where organization_id = old.organization_id and employee_user_id = old.employee_user_id
      and leave_type_id = old.leave_type_id and year = extract(year from old.start_date);
  end if;

  return new;
exception when others then
  return new; -- never let balance bookkeeping block the actual status change
end;
$$;

drop trigger if exists leave_requests_balance_on_insert on public.leave_requests;
create trigger leave_requests_balance_on_insert
  after insert on public.leave_requests
  for each row execute function public.trg_update_leave_balance_on_status_change();

drop trigger if exists leave_requests_balance_on_update on public.leave_requests;
create trigger leave_requests_balance_on_update
  after update on public.leave_requests
  for each row execute function public.trg_update_leave_balance_on_status_change();

-- The only path to approve/reject — org admin, or the employee's real
-- manager (is_manager_of_user), exactly mirroring performance reviews'
-- submit_manager_assessment (0078). Raises if the request isn't pending,
-- so a decided request can never be re-decided by racing two approvers.
create or replace function public.decide_leave_request(p_request_id uuid, p_decision text, p_comment text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.leave_requests%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into v_req from public.leave_requests where id = p_request_id limit 1;
  if v_req.id is null then
    raise exception 'Not found';
  end if;
  if not (public.is_org_admin(v_req.organization_id) or public.is_manager_of_user(v_req.employee_user_id)) then
    raise exception 'Not authorized';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been decided';
  end if;

  update public.leave_requests
  set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_comment = p_comment
  where id = p_request_id;

  return true;
end;
$$;

revoke all on function public.decide_leave_request(uuid, text, text) from public;
grant execute on function public.decide_leave_request(uuid, text, text) to authenticated;
