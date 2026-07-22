-- ============================================================
-- DEVOMETRICS — PENDING MIGRATIONS IN ONE PASTE
-- Combines 0076 + 0077 + 0078 + 0079 + 0080 + 0081 (Impact Cycles, its
-- standard-appraisal-shape upgrade, the manager-role RBAC fix, employee ID
-- + seat limits, the daily insight cache, and platform-admin company
-- provisioning). Every statement is idempotent (IF NOT EXISTS / OR REPLACE
-- / DROP ... IF EXISTS / a catalog-lookup DO block instead of a guessed
-- constraint name), so running this more than once, or after part of it
-- already ran, is safe. Order matters within this file (0077 alters tables
-- 0076 creates; 0078 replaces functions 0076/0077 create; 0081 redefines
-- the organization_members insert policy 0079 last defined) — paste and
-- run the whole thing as one block.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run.
-- ============================================================

-- ============================================================
-- 0076: Impact Cycles foundation — cycles, self-assessment
-- (Your Reflection), manager assessment (Manager's Perspective),
-- goals (Focus Areas), employee acknowledgment
-- ============================================================

create table if not exists public.performance_review_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  opens_at date,
  closes_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.performance_review_cycles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'not_started' check (
    status in ('not_started', 'self_submitted', 'manager_submitted', 'acknowledged')
  ),
  employee_acknowledged_at timestamptz,
  employee_acknowledgment_comment text,
  created_at timestamptz not null default now(),
  unique (cycle_id, employee_user_id)
);

create table if not exists public.performance_review_self_assessments (
  review_id uuid primary key references public.performance_reviews(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  reflection text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_review_manager_assessments (
  review_id uuid primary key references public.performance_reviews(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  rating integer check (rating between 1 and 5),
  feedback text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_review_goals (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'achieved', 'missed')
  ),
  created_at timestamptz not null default now()
);

alter table public.performance_review_cycles enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.performance_review_self_assessments enable row level security;
alter table public.performance_review_manager_assessments enable row level security;
alter table public.performance_review_goals enable row level security;

drop policy if exists "Admins manage review cycles" on public.performance_review_cycles;
create policy "Admins manage review cycles"
  on public.performance_review_cycles for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view their cycles" on public.performance_review_cycles;
create policy "Org members can view their cycles"
  on public.performance_review_cycles for select
  using (public.is_org_member(organization_id));

drop policy if exists "Admins manage reviews" on public.performance_reviews;
create policy "Admins manage reviews"
  on public.performance_reviews for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Employees can view their own review" on public.performance_reviews;
create policy "Employees can view their own review"
  on public.performance_reviews for select
  using (employee_user_id = auth.uid());

drop policy if exists "View own self-assessment" on public.performance_review_self_assessments;
create policy "View own self-assessment"
  on public.performance_review_self_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and r.employee_user_id = auth.uid()
    )
  );

drop policy if exists "Admins view self-assessments in their org" on public.performance_review_self_assessments;
create policy "Admins view self-assessments in their org"
  on public.performance_review_self_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_org_admin(r.organization_id)
    )
  );

drop policy if exists "View own manager-assessment" on public.performance_review_manager_assessments;
create policy "View own manager-assessment"
  on public.performance_review_manager_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and r.employee_user_id = auth.uid()
    )
  );

drop policy if exists "Admins view manager-assessments in their org" on public.performance_review_manager_assessments;
create policy "Admins view manager-assessments in their org"
  on public.performance_review_manager_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_org_admin(r.organization_id)
    )
  );

drop policy if exists "Admins manage review goals" on public.performance_review_goals;
create policy "Admins manage review goals"
  on public.performance_review_goals for all
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_org_admin(r.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_org_admin(r.organization_id)
    )
  );

drop policy if exists "Employees can view their own review goals" on public.performance_review_goals;
create policy "Employees can view their own review goals"
  on public.performance_review_goals for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and r.employee_user_id = auth.uid()
    )
  );

create or replace function public.ensure_reviews_for_cycle(target_cycle_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_count integer;
begin
  select organization_id into v_org_id from public.performance_review_cycles where id = target_cycle_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_reviews (cycle_id, organization_id, employee_user_id)
  select target_cycle_id, v_org_id, m.user_id
  from public.organization_members m
  where m.organization_id = v_org_id
  on conflict (cycle_id, employee_user_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.ensure_reviews_for_cycle(uuid) from public;
grant execute on function public.ensure_reviews_for_cycle(uuid) to authenticated;

create or replace function public.submit_self_assessment(target_review_id uuid, p_rating integer, p_reflection text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
begin
  select employee_user_id into v_employee from public.performance_reviews where id = target_review_id;
  if v_employee is null or v_employee != auth.uid() then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_self_assessments (review_id, rating, reflection, submitted_at)
  values (target_review_id, p_rating, p_reflection, now())
  on conflict (review_id) do update
    set rating = excluded.rating, reflection = excluded.reflection, submitted_at = now(), updated_at = now();

  update public.performance_reviews
    set status = 'self_submitted'
    where id = target_review_id and status = 'not_started';
end;
$$;

revoke all on function public.submit_self_assessment(uuid, integer, text) from public;
grant execute on function public.submit_self_assessment(uuid, integer, text) to authenticated;

create or replace function public.submit_manager_assessment(target_review_id uuid, p_rating integer, p_feedback text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_manager_assessments (review_id, reviewer_user_id, rating, feedback, submitted_at)
  values (target_review_id, auth.uid(), p_rating, p_feedback, now())
  on conflict (review_id) do update
    set reviewer_user_id = auth.uid(), rating = excluded.rating, feedback = excluded.feedback,
        submitted_at = now(), updated_at = now();

  update public.performance_reviews set status = 'manager_submitted' where id = target_review_id;

  update public.organization_members
    set performance_rating = p_rating,
        performance_rating_note = p_feedback,
        performance_rating_updated_at = now()
    where organization_id = v_org_id and user_id = v_employee;
end;
$$;

revoke all on function public.submit_manager_assessment(uuid, integer, text) from public;
grant execute on function public.submit_manager_assessment(uuid, integer, text) to authenticated;

create or replace function public.acknowledge_review(target_review_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
begin
  select employee_user_id into v_employee from public.performance_reviews where id = target_review_id;
  if v_employee is null or v_employee != auth.uid() then
    raise exception 'Not authorized';
  end if;

  update public.performance_reviews
    set employee_acknowledged_at = now(), employee_acknowledgment_comment = p_comment, status = 'acknowledged'
    where id = target_review_id;
end;
$$;

revoke all on function public.acknowledge_review(uuid, text) from public;
grant execute on function public.acknowledge_review(uuid, text) to authenticated;

create index if not exists performance_review_cycles_org_idx on public.performance_review_cycles (organization_id);
create index if not exists performance_reviews_cycle_idx on public.performance_reviews (cycle_id);
create index if not exists performance_reviews_employee_idx on public.performance_reviews (employee_user_id);
create index if not exists performance_review_goals_review_idx on public.performance_review_goals (review_id);

-- ============================================================
-- 0077: Standard appraisal shape — KPI-enabled Focus Areas,
-- competency ratings, development needs, Conclusion + dual sign-off
-- ============================================================

alter table public.performance_review_goals
  add column if not exists target text,
  add column if not exists actual text;

create table if not exists public.performance_review_competency_ratings (
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  dimension text not null,
  rating integer not null check (rating between 1 and 5),
  note text,
  primary key (review_id, dimension)
);

alter table public.performance_review_competency_ratings enable row level security;

drop policy if exists "View own competency ratings" on public.performance_review_competency_ratings;
create policy "View own competency ratings"
  on public.performance_review_competency_ratings for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and r.employee_user_id = auth.uid()
    )
  );

drop policy if exists "Admins view competency ratings in their org" on public.performance_review_competency_ratings;
create policy "Admins view competency ratings in their org"
  on public.performance_review_competency_ratings for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_org_admin(r.organization_id)
    )
  );

alter table public.performance_review_manager_assessments
  add column if not exists development_needs text;

do $$
declare
  existing_constraint text;
begin
  select tc.constraint_name into existing_constraint
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
    and ccu.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'performance_reviews'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'status'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.performance_reviews drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.performance_reviews
  add constraint performance_reviews_status_check
  check (status in ('not_started', 'self_submitted', 'manager_submitted', 'acknowledged', 'closed'));

alter table public.performance_reviews
  add column if not exists conclusion text,
  add column if not exists manager_closed_at timestamptz,
  add column if not exists manager_closed_by uuid references auth.users(id) on delete set null;

create or replace function public.close_review(target_review_id uuid, p_conclusion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_has_manager_assessment boolean;
begin
  select organization_id into v_org_id from public.performance_reviews where id = target_review_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;

  select exists (
    select 1 from public.performance_review_manager_assessments
    where review_id = target_review_id and submitted_at is not null
  ) into v_has_manager_assessment;
  if not v_has_manager_assessment then
    raise exception 'Submit the Manager''s Perspective before closing the cycle';
  end if;

  update public.performance_reviews
    set conclusion = p_conclusion, manager_closed_at = now(), manager_closed_by = auth.uid(), status = 'closed'
    where id = target_review_id;
end;
$$;

revoke all on function public.close_review(uuid, text) from public;
grant execute on function public.close_review(uuid, text) to authenticated;

create or replace function public.set_competency_rating(target_review_id uuid, p_dimension text, p_rating integer, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.performance_reviews where id = target_review_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_competency_ratings (review_id, dimension, rating, note)
  values (target_review_id, p_dimension, p_rating, p_note)
  on conflict (review_id, dimension) do update
    set rating = excluded.rating, note = excluded.note;
end;
$$;

revoke all on function public.set_competency_rating(uuid, text, integer, text) from public;
grant execute on function public.set_competency_rating(uuid, text, integer, text) to authenticated;

create index if not exists performance_review_competency_ratings_review_idx on public.performance_review_competency_ratings (review_id);

-- ============================================================
-- 0078: Manager-role RBAC fix — a real reporting-line manager
-- (not just an org admin) can now conduct their own direct
-- report's Impact Cycle
-- ============================================================

create or replace function public.is_manager_of_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where user_id = target_user_id and manager_user_id = auth.uid()
  );
$$;

revoke all on function public.is_manager_of_user(uuid) from public;
grant execute on function public.is_manager_of_user(uuid) to authenticated;

drop policy if exists "Managers can view their direct reports' profiles" on public.profiles;
create policy "Managers can view their direct reports' profiles"
  on public.profiles for select
  using (public.is_manager_of_user(id));

drop policy if exists "Managers can view their direct reports' reviews" on public.performance_reviews;
create policy "Managers can view their direct reports' reviews"
  on public.performance_reviews for select
  using (public.is_manager_of_user(employee_user_id));

drop policy if exists "Managers view direct reports' self-assessments" on public.performance_review_self_assessments;
create policy "Managers view direct reports' self-assessments"
  on public.performance_review_self_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

drop policy if exists "Managers view direct reports' manager-assessments" on public.performance_review_manager_assessments;
create policy "Managers view direct reports' manager-assessments"
  on public.performance_review_manager_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

drop policy if exists "Managers manage direct reports' review goals" on public.performance_review_goals;
create policy "Managers manage direct reports' review goals"
  on public.performance_review_goals for all
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  )
  with check (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

drop policy if exists "Managers view direct reports' competency ratings" on public.performance_review_competency_ratings;
create policy "Managers view direct reports' competency ratings"
  on public.performance_review_competency_ratings for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

create or replace function public.submit_manager_assessment(target_review_id uuid, p_rating integer, p_feedback text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_manager_assessments (review_id, reviewer_user_id, rating, feedback, submitted_at)
  values (target_review_id, auth.uid(), p_rating, p_feedback, now())
  on conflict (review_id) do update
    set reviewer_user_id = auth.uid(), rating = excluded.rating, feedback = excluded.feedback,
        submitted_at = now(), updated_at = now();

  update public.performance_reviews set status = 'manager_submitted' where id = target_review_id;

  update public.organization_members
    set performance_rating = p_rating,
        performance_rating_note = p_feedback,
        performance_rating_updated_at = now()
    where organization_id = v_org_id and user_id = v_employee;
end;
$$;

revoke all on function public.submit_manager_assessment(uuid, integer, text) from public;
grant execute on function public.submit_manager_assessment(uuid, integer, text) to authenticated;

create or replace function public.close_review(target_review_id uuid, p_conclusion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_has_manager_assessment boolean;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  select exists (
    select 1 from public.performance_review_manager_assessments
    where review_id = target_review_id and submitted_at is not null
  ) into v_has_manager_assessment;
  if not v_has_manager_assessment then
    raise exception 'Submit the Manager''s Perspective before closing the cycle';
  end if;

  update public.performance_reviews
    set conclusion = p_conclusion, manager_closed_at = now(), manager_closed_by = auth.uid(), status = 'closed'
    where id = target_review_id;
end;
$$;

revoke all on function public.close_review(uuid, text) from public;
grant execute on function public.close_review(uuid, text) to authenticated;

create or replace function public.set_competency_rating(target_review_id uuid, p_dimension text, p_rating integer, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_competency_ratings (review_id, dimension, rating, note)
  values (target_review_id, p_dimension, p_rating, p_note)
  on conflict (review_id, dimension) do update
    set rating = excluded.rating, note = excluded.note;
end;
$$;

revoke all on function public.set_competency_rating(uuid, text, integer, text) from public;
grant execute on function public.set_competency_rating(uuid, text, integer, text) to authenticated;

-- ============================================================
-- 0079: Employee ID (HR field) + platform-admin-controlled
-- seat limits per organization
-- ============================================================

alter table public.organization_members
  add column if not exists employee_id text;

alter table public.organizations
  add column if not exists seat_limit integer;

drop policy if exists "Platform admins can update organizations" on public.organizations;
create policy "Platform admins can update organizations"
  on public.organizations for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.org_seat_limit_ok(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    (select seat_limit from public.organizations where id = target_org_id) is null
    or (select count(*) from public.organization_members where organization_id = target_org_id)
       < (select seat_limit from public.organizations where id = target_org_id);
$$;

drop policy if exists "Users can join an organization as themselves" on public.organization_members;
create policy "Users can join an organization as themselves"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      (role = 'admin' and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      ))
      or (role = 'member' and public.org_seat_limit_ok(organization_id))
    )
  );

-- ============================================================
-- 0080: Daily insight cache (one AI insight per user per day)
-- ============================================================

create table if not exists public.career_gps_daily_insights (
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_date date not null,
  insight text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, insight_date)
);

alter table public.career_gps_daily_insights enable row level security;

drop policy if exists "Users can manage their own daily insights" on public.career_gps_daily_insights;
create policy "Users can manage their own daily insights"
  on public.career_gps_daily_insights for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 0081: Platform-admin company provisioning
-- ============================================================

-- Lets a platform (super) admin provision a brand-new company workspace
-- from the backend — name, seat count, basic profile — and hand it off to
-- the company's actual admin, without the platform admin ever becoming a
-- member of that org themselves. This app has no service-role key, so the
-- platform admin still creates the org row as themselves (created_by =
-- their own uid, already permitted by 0016's "Authenticated users can
-- create an organization" policy) and the real admin claims it by signing
-- up against a pre-authorized invite — same "invite, don't impersonate"
-- shape as employee invites (0017), just for the founding admin seat.

-- Distinguishes "join an existing team as staff" from "become the founding
-- admin of a workspace someone already provisioned for you" — same table,
-- one more column, so bulkInviteEmployees/inviteEmployee callers are
-- unaffected by the default.
alter table public.organization_invites
  add column if not exists intended_role text not null default 'member';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'organization_invites'
      and constraint_name = 'organization_invites_intended_role_check'
  ) then
    alter table public.organization_invites
      add constraint organization_invites_intended_role_check
      check (intended_role in ('member', 'admin'));
  end if;
end $$;

-- Platform admins need to write invites for organizations they didn't
-- create and aren't a member of — the existing "Org admins can manage
-- invites for their organization" policy (is_org_admin-gated) doesn't
-- cover that. Same precedent as 0079's platform-admin write grant on
-- organizations itself.
drop policy if exists "Platform admins can manage any organization's invites" on public.organization_invites;
create policy "Platform admins can manage any organization's invites"
  on public.organization_invites for all
  using (public.is_admin())
  with check (public.is_admin());

-- Adds a third way to self-insert as 'admin': a platform-admin-provisioned,
-- not-yet-accepted invite addressed to your own verified email. Mirrors the
-- existing created_by = auth.uid() branch (self-serve signup) rather than
-- replacing it.
drop policy if exists "Users can join an organization as themselves" on public.organization_members;
create policy "Users can join an organization as themselves"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      (role = 'admin' and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      ))
      or (role = 'admin' and exists (
        select 1 from public.organization_invites i
        where i.organization_id = organization_id
          and i.intended_role = 'admin'
          and i.accepted_at is null
          and lower(i.email) = lower(auth.jwt() ->> 'email')
      ))
      or (role = 'member' and public.org_seat_limit_ok(organization_id))
    )
  );
