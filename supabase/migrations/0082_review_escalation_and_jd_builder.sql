-- Two independent additions requested together: (1) a configurable,
-- org-chart-based escalation/co-sign chain for Impact Cycles — skip-level
-- managers can see and comment on a review, not just the direct manager —
-- and (2) a text column to hold an AI-generated Job Description per role,
-- for the new JD builder on Job Architecture.

-- ============================================================
-- Part 1: Review escalation (skip-level visibility + co-sign)
-- ============================================================

-- How many manager-hops up the Org Chart get visibility + co-sign on a
-- review, beyond the direct manager (who always has full read/write via
-- the existing 0078 policies). 1 = direct manager only (today's behavior,
-- so nothing changes until an admin raises this). Each company picks their
-- own depth — "flexible" per how the founder described it, not a fixed 3.
alter table public.organizations
  add column if not exists review_escalation_levels integer not null default 1;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_review_escalation_levels_check'
  ) then
    alter table public.organizations
      add constraint organizations_review_escalation_levels_check
      check (review_escalation_levels between 1 and 10);
  end if;
end $$;

-- Walks organization_members.manager_user_id upward from target_user_id and
-- returns how many hops away the CALLER is (1 = direct manager, 2 =
-- skip-level, ...), capped at that org's review_escalation_levels. Returns
-- null if the caller isn't in the chain within that cap. A hard 10-hop
-- safety limit applies regardless of the org setting, independent of
-- whatever the org configures, to bound a pathological manager-cycle.
create or replace function public.upline_level_of_user(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_current uuid;
  v_org_id uuid;
  v_max_level integer;
  v_level integer := 0;
begin
  select organization_id, manager_user_id into v_org_id, v_current
  from public.organization_members
  where user_id = target_user_id;

  if v_org_id is null then
    return null;
  end if;

  select least(review_escalation_levels, 10) into v_max_level
  from public.organizations where id = v_org_id;

  while v_current is not null and v_level < coalesce(v_max_level, 1) loop
    v_level := v_level + 1;
    if v_current = auth.uid() then
      return v_level;
    end if;
    select manager_user_id into v_current
    from public.organization_members
    where user_id = v_current and organization_id = v_org_id;
  end loop;

  return null;
end;
$$;

revoke all on function public.upline_level_of_user(uuid) from public;
grant execute on function public.upline_level_of_user(uuid) to authenticated;

create or replace function public.is_upline_manager_of_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.upline_level_of_user(target_user_id) is not null;
$$;

revoke all on function public.is_upline_manager_of_user(uuid) from public;
grant execute on function public.is_upline_manager_of_user(uuid) to authenticated;

-- Read access for the whole configured chain (levels 1..N) — additive
-- alongside the existing direct-manager-only (0078) and org-admin (0076)
-- SELECT policies, so nothing already working changes when an org leaves
-- review_escalation_levels at its default of 1 (upline level 1 IS the
-- direct manager, so this is a superset, never a narrowing).
drop policy if exists "Upline managers can view reviews in their chain" on public.performance_reviews;
create policy "Upline managers can view reviews in their chain"
  on public.performance_reviews for select
  using (public.is_upline_manager_of_user(employee_user_id));

drop policy if exists "Upline managers view self-assessments in their chain" on public.performance_review_self_assessments;
create policy "Upline managers view self-assessments in their chain"
  on public.performance_review_self_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_upline_manager_of_user(r.employee_user_id)
    )
  );

drop policy if exists "Upline managers view manager-assessments in their chain" on public.performance_review_manager_assessments;
create policy "Upline managers view manager-assessments in their chain"
  on public.performance_review_manager_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_upline_manager_of_user(r.employee_user_id)
    )
  );

drop policy if exists "Upline managers view competency ratings in their chain" on public.performance_review_competency_ratings;
create policy "Upline managers view competency ratings in their chain"
  on public.performance_review_competency_ratings for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_upline_manager_of_user(r.employee_user_id)
    )
  );

-- The actual co-sign: a short comment + timestamp per upline manager per
-- review. Level 1 (the direct manager) keeps using the existing Manager's
-- Perspective flow (rating + feedback + development needs) — this table is
-- specifically for level 2+ (skip-level and above), a lighter-weight
-- "I've seen this and I concur / here's my note" rather than a full
-- independent rating.
create table if not exists public.performance_review_upline_signoffs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null check (level >= 2),
  comment text,
  signed_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, manager_user_id)
);

alter table public.performance_review_upline_signoffs enable row level security;

-- The employee sees co-signs on their OWN review ("his relevant part," not
-- anyone else's) — same posture as every other employee-facing policy on
-- these tables.
drop policy if exists "Employees can view upline signoffs on their own review" on public.performance_review_upline_signoffs;
create policy "Employees can view upline signoffs on their own review"
  on public.performance_review_upline_signoffs for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and r.employee_user_id = auth.uid()
    )
  );

drop policy if exists "Upline managers and admins can view signoffs in their chain" on public.performance_review_upline_signoffs;
create policy "Upline managers and admins can view signoffs in their chain"
  on public.performance_review_upline_signoffs for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id
        and (public.is_org_admin(r.organization_id) or public.is_upline_manager_of_user(r.employee_user_id))
    )
  );

-- Insert/update happens through submit_upline_signoff() below (security
-- definer, does its own level check) — no direct table write policy for
-- plain authenticated users, matching how submit_manager_assessment /
-- close_review / set_competency_rating are already gated in 0076-0078.

create or replace function public.submit_upline_signoff(target_review_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
  v_level integer;
begin
  select employee_user_id into v_employee
  from public.performance_reviews where id = target_review_id;
  if v_employee is null then
    raise exception 'Review not found';
  end if;

  v_level := public.upline_level_of_user(v_employee);
  if v_level is null or v_level < 2 then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_upline_signoffs (review_id, manager_user_id, level, comment, signed_off_at)
  values (target_review_id, auth.uid(), v_level, nullif(trim(p_comment), ''), now())
  on conflict (review_id, manager_user_id) do update
    set comment = excluded.comment, signed_off_at = now(), level = excluded.level, updated_at = now();
end;
$$;

revoke all on function public.submit_upline_signoff(uuid, text) from public;
grant execute on function public.submit_upline_signoff(uuid, text) to authenticated;

-- ============================================================
-- Part 2: JD builder — one generated description per role
-- ============================================================

alter table public.job_roles
  add column if not exists generated_jd text;
