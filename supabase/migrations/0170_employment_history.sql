-- 0170: Employment history timeline
--
-- Scoped by Ahmed's "yes for all" answer to job title changes / band
-- changes / join date. Built from what already exists rather than
-- duplicating storage:
--   - join date: computed at read time from organization_members.
--     created_at -- already the fact, no need for a redundant stored row.
--   - band changes: read straight from compensation_changes (0155), band
--     NAME only, NEVER amounts -- gated by the EXISTING
--     manager_compensation_visibility() (0157), not a new setting, since
--     it's literally the same underlying sensitive data compensation
--     already has a visibility model for. A manager who can't see a
--     report's band in the Compensation tab can't see it here either.
--   - title/role changes: genuinely new. organization_members.title
--     (0024) and current_role_id (0067) were always current-value-only
--     columns with no audit trail. This adds employment_history_events +
--     an AFTER UPDATE trigger that logs a row whenever either changes,
--     snapshotting the human-readable role title (job_roles.title) at
--     change time rather than just the id, so a later role rename/
--     deletion never corrupts old history. Gated by a NEW binary
--     employment_history_manager_visibility org setting (visible/hidden,
--     same shape as leave_manager_visibility, 0169) since this slice
--     isn't compensation data and doesn't belong behind that setting.
--
-- One real limitation, stated here rather than hidden: title/role change
-- logging can only start from whenever this migration is applied forward
-- -- there is no way to reconstruct changes that happened before
-- change-tracking existed. The 'joined' event is always present
-- (derived from created_at); title/role history may be incomplete for
-- anyone whose changes predate this migration.

alter table public.organizations
  add column if not exists employment_history_manager_visibility text not null default 'visible';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_employment_history_manager_visibility_check'
  ) then
    alter table public.organizations
      add constraint organizations_employment_history_manager_visibility_check
      check (employment_history_manager_visibility in ('visible', 'hidden'));
  end if;
end $$;

create table if not exists public.employment_history_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('title_change', 'role_change')),
  old_value text,
  new_value text,
  changed_by uuid references auth.users (id),
  effective_at timestamptz not null default now()
);

alter table public.employment_history_events enable row level security;
-- No client-facing policies -- same structural default-deny, RPC-only
-- posture as compensation's dollar-bearing tables (0154's header), since
-- this is written exclusively by the trigger below and read exclusively
-- through list_employee_history(). A direct client query returns
-- nothing, not an error.

create index if not exists employment_history_events_employee_idx
  on public.employment_history_events (employee_user_id, effective_at desc);

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

  return new;
exception when others then
  return new; -- never let history logging block the actual member update
end;
$$;

drop trigger if exists organization_members_log_title_role_change on public.organization_members;
create trigger organization_members_log_title_role_change
  after update on public.organization_members
  for each row execute function public.trg_log_member_title_role_change();

-- Self, org admin, or (direct manager AND the org allows it) -- same
-- authorization shape as every other employment-data RPC in this app.
-- Band-change events get an EXTRA, separate gate on top: manager_
-- compensation_visibility() must be 'band' or 'exact' -- see header.
create or replace function public.list_employee_history(target_user_id uuid)
returns table (
  event_type text,
  old_value text,
  new_value text,
  effective_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org_id uuid;
  v_joined_at timestamptz;
  v_history_visibility text;
  v_comp_visibility text;
  v_is_self boolean;
  v_is_admin boolean;
begin
  select m.organization_id, m.created_at into v_org_id, v_joined_at
  from public.organization_members m
  where m.user_id = target_user_id
  limit 1;

  if v_org_id is null then
    raise exception 'Not found';
  end if;

  v_is_self := (target_user_id = auth.uid());
  v_is_admin := public.is_org_admin(v_org_id);

  if not v_is_self and not v_is_admin then
    select coalesce(o.employment_history_manager_visibility, 'visible') into v_history_visibility
    from public.organizations o where o.id = v_org_id limit 1;
    if not public.is_manager_of_user(target_user_id) or v_history_visibility is distinct from 'visible' then
      raise exception 'Not authorized';
    end if;
  end if;

  v_comp_visibility := case
    when v_is_self or v_is_admin then 'exact'
    else public.manager_compensation_visibility(target_user_id)
  end;

  return query
  select * from (
    select 'joined'::text as event_type, null::text as old_value, null::text as new_value, v_joined_at as effective_at
    union all
    select e.event_type, e.old_value, e.new_value, e.effective_at
    from public.employment_history_events e
    where e.employee_user_id = target_user_id
    union all
    select 'band_change'::text, old_b.display_name, new_b.display_name, c.applied_at
    from public.compensation_changes c
    left join public.salary_bands old_b on old_b.id = c.old_salary_band_id
    left join public.salary_bands new_b on new_b.id = c.new_salary_band_id
    where c.employee_user_id = target_user_id
      and c.old_salary_band_id is distinct from c.new_salary_band_id
      and v_comp_visibility in ('band', 'exact')
  ) history
  order by effective_at desc;
end;
$$;

revoke all on function public.list_employee_history(uuid) from public;
grant execute on function public.list_employee_history(uuid) to authenticated;
