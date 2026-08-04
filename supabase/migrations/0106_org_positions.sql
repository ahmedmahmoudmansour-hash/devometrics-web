-- 0106: Vacant & structural positions in the Org Chart — Workstream 7 of
-- the 2026-08-03 strategic memo's Org Chart line of work, following
-- directly on 0105's rebuild. Adds a way to represent a hierarchy node
-- that isn't a real employee: a hireable vacant slot (optionally linked to
-- a Hiring posting and/or a Job Architecture role), or a purely structural
-- box (a department/board/committee — never fillable), per Ahmed's
-- reference org chart and his concrete example of a manager-level slot
-- ("Head of HR") that can itself be vacant while still having a mix of
-- real and vacant reports underneath it.
--
-- Purely additive — organization_members.manager_user_id (the existing,
-- load-bearing reporting-line column read by Team Pulse, the performance-
-- review upline chain, onboarding manager-approval routing, and the
-- automation recipes) is completely untouched by this migration, and
-- setMemberManager (lib/orgChart/actions.ts) is not modified at all. A new
-- sibling column, manager_position_id, is added so a real employee can be
-- displayed as reporting to a vacant position; every existing consumer of
-- manager_user_id already treats null as "no manager" gracefully (verified
-- by reading each one), so a person whose manager slot is a vacancy simply
-- shows as "no manager" everywhere else in the app — no other feature
-- needs any code change.
--
-- Filling a vacant position does NOT delete its row. It's marked
-- status = 'filled' with occupant_user_id/filled_at set and kept as a
-- permanent record (which position an employee filled, how long it sat
-- vacant, what requisition created it via linked_posting_id) — this is
-- deliberately the foundation for a future Position History / Workforce
-- Planning view, not built in this pass. Only a position that's cancelled
-- before ever being filled is actually deleted.

create table if not exists public.org_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('vacant_role', 'structural')),
  -- Lifecycle, independent of kind. 'open'/'future'/'frozen' are
  -- admin-settable via updatePosition; 'filled' is system-set only, by
  -- fill_org_position() below. Structural nodes (a department/committee
  -- box has no hiring lifecycle) stay 'open' by convention — enforced by
  -- org_positions_structural_shape below.
  status text not null default 'open' check (status in ('open', 'future', 'frozen', 'filled')),
  title text not null,
  -- Mirrors WorkforceRow's structural fields so the existing country/
  -- business-unit/department Org Chart filters work over positions
  -- unchanged, with no separate filter system needed.
  department text,
  business_unit text,
  country text,
  location text,
  -- A position's parent is exactly one of: another position, a real
  -- employee, or root (both null) — enforced by org_positions_single_parent
  -- below. Left populated even after a fill (see fill_org_position) as a
  -- historical record of where the position used to sit in the tree.
  parent_position_id uuid references public.org_positions(id) on delete cascade,
  parent_member_user_id uuid references auth.users(id) on delete set null,
  -- Both independently optional per Ahmed's explicit confirmation ("can we
  -- have both linked if I want to not linked") — forbidden on structural
  -- nodes. linked_posting_id also doubles as "which requisition created
  -- this position" once set, for future history/analytics use.
  linked_posting_id uuid references public.job_postings(id) on delete set null,
  linked_role_id uuid references public.job_roles(id) on delete set null,
  -- Set only by fill_org_position(). Vacancy duration = filled_at - created_at.
  occupant_user_id uuid references auth.users(id) on delete set null,
  filled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_positions
  drop constraint if exists org_positions_single_parent;
alter table public.org_positions
  add constraint org_positions_single_parent
  check (not (parent_position_id is not null and parent_member_user_id is not null));

alter table public.org_positions
  drop constraint if exists org_positions_not_self_parent;
alter table public.org_positions
  add constraint org_positions_not_self_parent
  check (id is distinct from parent_position_id);

alter table public.org_positions
  drop constraint if exists org_positions_structural_shape;
alter table public.org_positions
  add constraint org_positions_structural_shape
  check (
    kind <> 'structural'
    or (status = 'open' and linked_posting_id is null and linked_role_id is null)
  );

alter table public.org_positions
  drop constraint if exists org_positions_filled_shape;
alter table public.org_positions
  add constraint org_positions_filled_shape
  check (
    (status = 'filled') = (occupant_user_id is not null)
  );

create index if not exists org_positions_org_idx on public.org_positions (organization_id);
create index if not exists org_positions_parent_position_idx on public.org_positions (parent_position_id);
create index if not exists org_positions_parent_member_idx on public.org_positions (parent_member_user_id);
create index if not exists org_positions_status_idx on public.org_positions (status);

alter table public.org_positions enable row level security;

drop policy if exists "Org members can view positions" on public.org_positions;
create policy "Org members can view positions"
  on public.org_positions for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins can create positions" on public.org_positions;
create policy "Org admins can create positions"
  on public.org_positions for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can update positions" on public.org_positions;
create policy "Org admins can update positions"
  on public.org_positions for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Deliberately NO delete policy — a direct client-side DELETE would
-- orphan/cascade-delete an entire subtree. Deletion only happens inside
-- delete_org_position() below, which re-parents affected children first.

alter table public.organization_members
  add column if not exists manager_position_id uuid references public.org_positions(id) on delete set null;

alter table public.organization_members
  drop constraint if exists organization_members_single_manager_kind;
alter table public.organization_members
  add constraint organization_members_single_manager_kind
  check (not (manager_user_id is not null and manager_position_id is not null));

create index if not exists organization_members_manager_position_idx on public.organization_members (manager_position_id);
-- No new RLS needed on organization_members — manager_position_id is
-- covered by the existing "org admins can update member records" UPDATE
-- policy (migration 0049) the same way manager_user_id already is.

-- Cancels a position that was never filled (a planned role that's off the
-- table, or a structural box being removed): re-parents its direct
-- children (both real members and other positions) up to its own parent,
-- then actually deletes the row — there's no occupant history to lose.
-- SECURITY DEFINER because it bypasses RLS to do a multi-row atomic
-- operation; does its own is_org_admin check since RLS itself is bypassed.
create or replace function public.delete_org_position(target_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_parent_position_id uuid;
  v_parent_member_user_id uuid;
begin
  select organization_id, parent_position_id, parent_member_user_id
    into v_org_id, v_parent_position_id, v_parent_member_user_id
    from public.org_positions
    where id = target_position_id;

  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'not authorized';
  end if;

  update public.organization_members
    set manager_position_id = v_parent_position_id,
        manager_user_id = v_parent_member_user_id
    where manager_position_id = target_position_id;

  update public.org_positions
    set parent_position_id = v_parent_position_id,
        parent_member_user_id = v_parent_member_user_id
    where parent_position_id = target_position_id;

  delete from public.org_positions where id = target_position_id;
end;
$$;

-- Fills a vacant role with a real employee: places them exactly where the
-- vacancy sat (mirrors its parent), moves the vacancy's own direct reports
-- (both real members and child positions) onto the new employee, then
-- marks the position row 'filled' with the occupant/timestamp recorded —
-- unlike delete_org_position, the row is kept as a permanent history
-- record, not deleted. Deliberately NOT wired into the automatic
-- onboarding trigger chain (runHireToOnboarding/instantiateOnboarding) —
-- called explicitly by an admin once the new hire's account already
-- exists. SECURITY DEFINER for the same reason as delete_org_position.
create or replace function public.fill_org_position(target_position_id uuid, target_employee_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_kind text;
  v_parent_position_id uuid;
  v_parent_member_user_id uuid;
begin
  select organization_id, kind, parent_position_id, parent_member_user_id
    into v_org_id, v_kind, v_parent_position_id, v_parent_member_user_id
    from public.org_positions
    where id = target_position_id;

  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'not authorized';
  end if;

  if v_kind <> 'vacant_role' then
    raise exception 'only a vacant role can be filled';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and user_id = target_employee_user_id
  ) then
    raise exception 'employee is not a member of this organization';
  end if;

  update public.organization_members
    set manager_user_id = v_parent_member_user_id,
        manager_position_id = v_parent_position_id
    where organization_id = v_org_id and user_id = target_employee_user_id;

  update public.organization_members
    set manager_position_id = null,
        manager_user_id = target_employee_user_id
    where manager_position_id = target_position_id;

  update public.org_positions
    set parent_position_id = null,
        parent_member_user_id = target_employee_user_id
    where parent_position_id = target_position_id;

  update public.org_positions
    set status = 'filled',
        occupant_user_id = target_employee_user_id,
        filled_at = now(),
        updated_at = now()
    where id = target_position_id;
end;
$$;

grant execute on function public.delete_org_position(uuid) to authenticated;
grant execute on function public.fill_org_position(uuid, uuid) to authenticated;
