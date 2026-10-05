-- 0189 -- Two things Ahmed asked for after checking the employee file:
--
-- A) Reporting-line and department history, and a real effective date on
--    status changes. The employment history timeline (0170/0172) already
--    logged title, role and status changes; the manager (manager_user_id /
--    manager_position_id) and department were current-value-only, so a
--    change silently overwrote the old one. This extends the SAME trigger
--    and the SAME event table -- no new read path: list_employee_history()
--    (0170) already returns every row of employment_history_events, so the
--    existing visibility rules (self, org admin, direct manager unless the
--    org hides it) apply to the new event types unchanged.
--
--    Status changes already carried a timestamp, but it was always "now".
--    HR can now record the date it actually took effect (e.g. a resignation
--    that was processed late): organization_members gains
--    employment_status_effective_date, which the app writes on every status
--    change (a date, or null for "today"), and the trigger uses it as the
--    event's effective_at. Same limitation as 0170: logging starts from
--    when this is applied; earlier manager/department changes can't be
--    reconstructed.
--
-- B) Company-defined employee fields (insurance number, tax ID, bank
--    details, anything a company in any country needs) -- a per-org
--    definition table plus a per-employee value table, mirroring
--    organization_competencies (0035) for the definitions and the
--    employee-file privacy model (0181) for the values: only the employee
--    and org admins can read a value -- not managers, not peers. A field is
--    either employee-editable or HR-only (enforced in RLS, not just the UI).
--
-- Depends on 0170/0172 (employment_history_events, trigger), 0106
-- (org_positions), 0181 (employee file privacy model).

-- ============================================================
-- A) History: manager, department, dated status
-- ============================================================
alter table public.organization_members
  add column if not exists employment_status_effective_date date;

alter table public.employment_history_events
  drop constraint if exists employment_history_events_event_type_check;
alter table public.employment_history_events
  add constraint employment_history_events_event_type_check
  check (event_type in ('title_change', 'role_change', 'status_change', 'manager_change', 'department_change'));

-- Human-readable manager label, snapshotted into the event at change time
-- (same reasoning as role_change snapshotting job_roles.title): a later
-- rename or deletion must never corrupt old history. Never throws.
create or replace function public.history_manager_label(p_user_id uuid, p_position_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v text;
begin
  if p_user_id is not null then
    select nullif(trim(full_name), '') into v from public.profiles where id = p_user_id limit 1;
    return coalesce(v, 'Unknown');
  elsif p_position_id is not null then
    select title into v from public.org_positions where id = p_position_id limit 1;
    return coalesce(v, 'Vacant position');
  end if;
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.history_manager_label(uuid, uuid) from public;
grant execute on function public.history_manager_label(uuid, uuid) to authenticated;

-- Superset of 0172's version: every existing branch is unchanged, plus
-- manager_change, department_change, and the effective-date override on
-- status_change.
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
      (organization_id, employee_user_id, event_type, old_value, new_value, changed_by, effective_at)
    values (
      new.organization_id, new.user_id, 'status_change', old.employment_status, new.employment_status, auth.uid(),
      coalesce(new.employment_status_effective_date::timestamptz, now())
    );
  end if;

  if new.manager_user_id is distinct from old.manager_user_id
     or new.manager_position_id is distinct from old.manager_position_id then
    insert into public.employment_history_events
      (organization_id, employee_user_id, event_type, old_value, new_value, changed_by)
    values (
      new.organization_id, new.user_id, 'manager_change',
      public.history_manager_label(old.manager_user_id, old.manager_position_id),
      public.history_manager_label(new.manager_user_id, new.manager_position_id),
      auth.uid()
    );
  end if;

  if new.department is distinct from old.department then
    insert into public.employment_history_events
      (organization_id, employee_user_id, event_type, old_value, new_value, changed_by)
    values (new.organization_id, new.user_id, 'department_change', old.department, new.department, auth.uid());
  end if;

  return new;
exception when others then
  return new; -- never let history logging block the actual member update
end;
$$;

-- ============================================================
-- B) Company-defined employee fields
-- ============================================================
create table if not exists public.organization_employee_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  -- false = HR-only: only an org admin can set the value.
  employee_editable boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

alter table public.organization_employee_fields enable row level security;

-- Labels only, no per-person data -- any member can see them.
drop policy if exists "Org members can view employee field definitions" on public.organization_employee_fields;
create policy "Org members can view employee field definitions"
  on public.organization_employee_fields for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins manage employee field definitions" on public.organization_employee_fields;
create policy "Org admins manage employee field definitions"
  on public.organization_employee_fields for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists organization_employee_fields_org_idx on public.organization_employee_fields (organization_id);

create table if not exists public.employee_field_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  field_id uuid not null references public.organization_employee_fields (id) on delete cascade,
  value text not null check (char_length(value) between 1 and 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (user_id, field_id)
);

alter table public.employee_field_values enable row level security;

drop policy if exists "Org admins manage employee field values" on public.employee_field_values;
create policy "Org admins manage employee field values"
  on public.employee_field_values for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Employees read their own field values" on public.employee_field_values;
create policy "Employees read their own field values"
  on public.employee_field_values for select
  using (user_id = auth.uid() and public.is_org_member(organization_id));

-- An employee may write/remove their OWN value, only for a field that (a)
-- belongs to their own org and (b) HR marked employee-editable. Enforced
-- here, not just hidden in the UI.
drop policy if exists "Employees add their own editable field values" on public.employee_field_values;
create policy "Employees add their own editable field values"
  on public.employee_field_values for insert
  with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
    and exists (
      select 1 from public.organization_employee_fields f
      where f.id = field_id and f.organization_id = employee_field_values.organization_id and f.employee_editable
    )
  );

drop policy if exists "Employees update their own editable field values" on public.employee_field_values;
create policy "Employees update their own editable field values"
  on public.employee_field_values for update
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
    and exists (
      select 1 from public.organization_employee_fields f
      where f.id = field_id and f.organization_id = employee_field_values.organization_id and f.employee_editable
    )
  );

drop policy if exists "Employees remove their own editable field values" on public.employee_field_values;
create policy "Employees remove their own editable field values"
  on public.employee_field_values for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_employee_fields f
      where f.id = field_id and f.employee_editable
    )
  );

create index if not exists employee_field_values_user_idx on public.employee_field_values (organization_id, user_id);
