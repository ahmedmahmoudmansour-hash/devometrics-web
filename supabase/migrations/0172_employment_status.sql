-- 0172: Employment status (active / resigned / terminated)
--
-- Requested 2026-09-23: the Employees page had no concept of someone
-- having left the company — the only way to remove them was deleting
-- their organization_members row outright, destroying their history
-- (leave, compensation, employment history) in the same stroke. This adds
-- a real status instead, defaulting every existing and new row to
-- 'active' so NOTHING changes for anyone until an admin explicitly acts.
--
-- The actual "gate off access once inactive" mechanism is a one-line
-- addition to the SAME four SECURITY DEFINER helpers dozens of existing
-- RLS policies already depend on (is_org_member, is_org_admin,
-- is_org_admin_of_user, is_manager_of_user) plus has_compensation_access
-- -- not a new scattered set of checks. This is deliberately the
-- HIGHEST-blast-radius change made this session; see the reasoning below
-- each function for exactly what was and wasn't changed and why.
--
-- Historical data is never touched: a resigned/terminated person's rows
-- in leave_requests/compensation_records/employment_history_events/etc.
-- all stay exactly as they are. Only their own ability to authenticate AS
-- an org member (and, for is_org_admin_of_user, an ADMIN's caller-side
-- standing) is gated -- is_org_admin_of_user deliberately does NOT gate
-- on the *target's* status, so an active admin can still see a departed
-- employee's historical records for compliance/reference purposes.

alter table public.organization_members
  add column if not exists employment_status text not null default 'active';
alter table public.organization_members
  add column if not exists employment_status_changed_at timestamptz;
alter table public.organization_members
  add column if not exists employment_status_changed_by uuid references auth.users (id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organization_members'
      and constraint_name = 'organization_members_employment_status_check'
  ) then
    alter table public.organization_members
      add constraint organization_members_employment_status_check
      check (employment_status in ('active', 'resigned', 'terminated'));
  end if;
end $$;

-- --- Core gates: caller's own row must be active ---

create or replace function public.is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = check_org_id and user_id = auth.uid() and employment_status = 'active'
  );
$$;

create or replace function public.is_org_admin(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = check_org_id and user_id = auth.uid() and role = 'admin' and employment_status = 'active'
  );
$$;

-- Gates on the ADMIN's (caller's) own row only, deliberately -- see
-- header. target_m is left unfiltered so an active admin retains
-- visibility into a departed employee's gap_analyses/profile/etc.
create or replace function public.is_org_admin_of_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members admin_m
    join public.organization_members target_m
      on target_m.organization_id = admin_m.organization_id
    where admin_m.user_id = auth.uid()
      and admin_m.role = 'admin'
      and admin_m.employment_status = 'active'
      and target_m.user_id = target_user_id
  );
$$;

-- Two independent EXISTS checks rather than a self-join -- avoids any
-- multi-row-per-org join surprises given organization_members has no
-- constraint preventing a user from belonging to more than one org (same
-- reasoning as every other helper in this codebase). Gates the CALLER's
-- (manager's) own row; the target report's status is left unfiltered for
-- the same historical-visibility reason as is_org_admin_of_user.
create or replace function public.is_manager_of_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.organization_members
      where user_id = target_user_id and manager_user_id = auth.uid()
    )
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid() and employment_status = 'active'
    );
$$;

-- A resigned/terminated Compensation Admin loses that access too --
-- organization_compensation_admins (0156) is a separate grant table that
-- doesn't route through is_org_admin/is_org_member at all, so it needed
-- its own explicit gate.
create or replace function public.has_compensation_access(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_compensation_admins ca
    join public.organization_members m
      on m.organization_id = ca.organization_id and m.user_id = ca.user_id
    where ca.organization_id = check_org_id
      and ca.user_id = auth.uid()
      and m.employment_status = 'active'
  );
$$;

-- --- Owner protection (extends 0163's trigger) ---
--
-- 0163 already blocks demoting the workspace owner's role or deleting
-- their row without transferring ownership first. Setting their
-- employment_status away from 'active' has the exact same effect now
-- (is_org_admin would stop returning true for them) and needs the same
-- guard, or the owner could be silently locked out of their own
-- workspace with no self-service recovery.
create or replace function public.trg_protect_org_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective_owner uuid;
  v_org_id uuid;
  v_user_id uuid;
begin
  v_org_id := coalesce(new.organization_id, old.organization_id);
  v_user_id := coalesce(new.user_id, old.user_id);

  select coalesce(owner_user_id, created_by) into v_effective_owner
  from public.organizations where id = v_org_id limit 1;

  if v_effective_owner is distinct from v_user_id then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'This person owns the workspace — transfer ownership to someone else before they can leave.';
  end if;

  if tg_op = 'UPDATE' and new.role <> 'admin' then
    raise exception 'This person owns the workspace — transfer ownership to someone else before removing their admin access.';
  end if;

  if tg_op = 'UPDATE' and new.employment_status is distinct from 'active' then
    raise exception 'This person owns the workspace — transfer ownership to someone else before changing their employment status.';
  end if;

  return coalesce(new, old);
end;
$$;

-- --- Log status changes into the employment history timeline (0170) ---

alter table public.employment_history_events
  drop constraint if exists employment_history_events_event_type_check;
alter table public.employment_history_events
  add constraint employment_history_events_event_type_check
  check (event_type in ('title_change', 'role_change', 'status_change'));

create or replace function public.trg_log_member_title_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role_title text;
  v_new_role_title text;
begin
  if new.title is distinct from old.title then
    insert into public.employment_history_events
      (organization_id, employee_user_id, event_type, old_value, new_value, changed_by)
    values (new.organization_id, new.user_id, 'title_change', old.title, new.title, auth.uid());
  end if;

  if new.current_role_id is distinct from old.current_role_id then
    select title into v_old_role_title from public.job_roles where id = old.current_role_id limit 1;
    select title into v_new_role_title from public.job_roles where id = new.current_role_id limit 1;
    insert into public.employment_history_events
      (organization_id, employee_user_id, event_type, old_value, new_value, changed_by)
    values (new.organization_id, new.user_id, 'role_change', v_old_role_title, v_new_role_title, auth.uid());
  end if;

  if new.employment_status is distinct from old.employment_status then
    insert into public.employment_history_events
      (organization_id, employee_user_id, event_type, old_value, new_value, changed_by)
    values (new.organization_id, new.user_id, 'status_change', old.employment_status, new.employment_status, auth.uid());
  end if;

  return new;
exception when others then
  return new; -- never let history logging block the actual member update
end;
$$;
