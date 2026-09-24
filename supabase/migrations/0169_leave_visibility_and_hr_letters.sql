-- 0169: Leave manager-visibility setting + HR Letter Requests
--
-- Two independent additions requested together (2026-09-23 overnight):
--
-- PART A — leave_manager_visibility. Compensation already has a 3-state
-- manager-visibility setting (exact/band/none, 0154) that an admin controls
-- from the Compensation Settings tab. Leave never had an equivalent — any
-- manager automatically sees a direct report's FULL leave_requests/
-- leave_balances rows (dates, reason, balance) via plain RLS
-- (is_manager_of_user), with no admin control to dial that back. Unlike
-- compensation, a manager's core job here (approving a pending request)
-- genuinely requires seeing that request's own detail, so this setting
-- deliberately does NOT gate the existing pending-approval path
-- (leave_requests RLS / decide_leave_request are untouched) — it only
-- gates a NEW "browse my team's balances" surface
-- (list_team_leave_overview), which is a convenience/oversight feature,
-- not a workflow necessity. Binary (visible/hidden), not 3-state like
-- compensation's exact/band/none — there's no natural "band-only"
-- equivalent for a day count the way there is for a dollar amount.
--
-- PART B — hr_letter_requests. An employee can request an HR letter
-- (employment verification / salary certificate), choosing whether it
-- includes their salary figure or not. This creates a request row and
-- notifies org admins (the app layer sends the email — see
-- lib/hrLetters/actions.ts — this migration only adds the get_org_admin_
-- emails RPC it needs, since profiles.email isn't readable by a plain
-- employee under normal RLS). HR issues or rejects it from a new admin
-- queue. Deciding is a function only (decide_hr_letter_request), never a
-- raw UPDATE policy — same reasoning as leave_requests/organization_members:
-- a direct PATCH must never bypass the org-admin-only + already-decided +
-- self-approval guards. The self-approval guard mirrors 0168's exact
-- shape (block only when another eligible decider — another org admin —
-- actually exists, so a solo admin isn't locked out of their own request).
--
-- Does NOT touch attendance/GPS — still explicitly out of scope, deferred
-- separately per the "Both, but leave/vacation first" decision.

-- ============================================================
-- PART A — leave manager visibility
-- ============================================================

alter table public.organizations
  add column if not exists leave_manager_visibility text not null default 'visible';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_leave_manager_visibility_check'
  ) then
    alter table public.organizations
      add constraint organizations_leave_manager_visibility_check
      check (leave_manager_visibility in ('visible', 'hidden'));
  end if;
end $$;

-- A manager's own reports' balances only, respecting the org setting.
-- Deliberately separate from the untouched pending-approval RLS path (see
-- header) — this is the "browse my team" convenience surface only.
-- Never throws (returns empty instead), per the migration skill's RLS-
-- helper discipline, even though this isn't used inside a policy itself —
-- kept consistent since it's the same class of function.
create or replace function public.list_team_leave_overview(check_org_id uuid)
returns table (
  employee_user_id uuid,
  leave_type_id uuid,
  year int,
  allocated_days numeric,
  used_days numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_visibility text;
begin
  select coalesce(o.leave_manager_visibility, 'visible') into v_visibility
  from public.organizations o where o.id = check_org_id limit 1;

  if v_visibility is distinct from 'visible' then
    return;
  end if;

  return query
  select b.employee_user_id, b.leave_type_id, b.year, b.allocated_days, b.used_days
  from public.leave_balances b
  join public.organization_members m
    on m.organization_id = b.organization_id and m.user_id = b.employee_user_id
  where b.organization_id = check_org_id
    and m.manager_user_id = auth.uid();
exception when others then
  return;
end;
$$;

revoke all on function public.list_team_leave_overview(uuid) from public;
grant execute on function public.list_team_leave_overview(uuid) to authenticated;

-- ============================================================
-- PART B — HR letter requests
-- ============================================================

create table if not exists public.hr_letter_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id),
  include_salary boolean not null default false,
  purpose text,
  status text not null default 'pending' check (status in ('pending', 'issued', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id),
  decision_note text
);

alter table public.hr_letter_requests enable row level security;

-- Own requests only, or an org admin (HR) — a manager who isn't an org
-- admin has no visibility here at all, deliberately: an HR letter is
-- almost always for something personal (visa, loan, apartment lease), not
-- a workflow the direct manager needs any part of.
drop policy if exists "See own or admin hr letter requests" on public.hr_letter_requests;
create policy "See own or admin hr letter requests"
  on public.hr_letter_requests for select
  using (employee_user_id = auth.uid() or public.is_org_admin(organization_id));

-- Employees request for themselves only, always starting 'pending'; an org
-- admin can additionally record one on someone's behalf (e.g. a walk-in
-- request), same on-behalf-of shape as leave_requests' insert policy.
drop policy if exists "Employees request their own hr letters" on public.hr_letter_requests;
create policy "Employees request their own hr letters"
  on public.hr_letter_requests for insert
  with check (
    (employee_user_id = auth.uid() and requested_by = auth.uid() and status = 'pending')
    or public.is_org_admin(organization_id)
  );

create index if not exists hr_letter_requests_org_idx on public.hr_letter_requests (organization_id, status);
create index if not exists hr_letter_requests_employee_idx on public.hr_letter_requests (employee_user_id, requested_at desc);

create or replace function public.decide_hr_letter_request(p_request_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_status text;
  v_employee uuid;
begin
  if p_decision not in ('issued', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select organization_id, status, employee_user_id into v_org_id, v_status, v_employee
  from public.hr_letter_requests where id = p_request_id;

  if v_org_id is null then
    raise exception 'Not found';
  end if;
  if not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;
  if v_status <> 'pending' then
    raise exception 'This request has already been decided';
  end if;

  -- Same self-approval guard as decide_leave_request/decide_compensation_
  -- proposal/override_leave_decision (0168) — block only when another
  -- eligible decider (a different org admin) actually exists.
  if v_employee = auth.uid() and exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and role = 'admin' and user_id <> auth.uid()
  ) then
    raise exception 'You cannot decide your own HR letter request — another admin needs to review it';
  end if;

  update public.hr_letter_requests
  set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_note = p_note
  where id = p_request_id;
end;
$$;

revoke all on function public.decide_hr_letter_request(uuid, text, text) from public;
grant execute on function public.decide_hr_letter_request(uuid, text, text) to authenticated;

-- profiles.email exists (used by due_manager_action_reminders/due_
-- performance_review_reminders, 0126) but isn't selectable by a plain
-- employee under normal RLS — this is scoped to org admins of the same
-- org only, so a request author can notify HR without gaining any general
-- ability to read other members' emails.
create or replace function public.get_org_admin_emails(check_org_id uuid)
returns table (email text, full_name text)
language sql
security definer
set search_path = public
stable
as $$
  select p.email, p.full_name
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  where om.organization_id = check_org_id
    and om.role = 'admin'
    and p.email is not null
    and public.is_org_member(check_org_id);
$$;

revoke all on function public.get_org_admin_emails(uuid) from public;
grant execute on function public.get_org_admin_emails(uuid) to authenticated;
