-- ============================================================
-- DEVOMETRICS — PENDING MIGRATIONS IN ONE PASTE
-- Combines 0076 + 0077 + 0078 + 0079 + 0080 + 0081 + 0082 + 0083 (Impact
-- Cycles, its standard-appraisal-shape upgrade, the manager-role RBAC fix,
-- employee ID + seat limits, the daily insight cache, platform-admin
-- company provisioning, review escalation/co-sign, the JD builder, and a
-- hardening fix for a live production bug where upline_level_of_user()
-- could throw inside RLS and silently empty the admin's Impact Cycles
-- roster for every company) PLUS 0084 (Knowledge Hub — enterprise
-- LMS-lite: HR-uploaded training documents, multi-employee assignment,
-- exam or read-attestation completion, full RLS/RPC design so the exam
-- answer key can never be read by an employee even via a raw API call)
-- PLUS 0085 (Knowledge Hub due dates, an archive flag, video templates
-- added to the allowed upload types, and the overdue/due-soon reminder
-- RPCs that piggyback on the existing daily task-reminders cron). Every
-- statement is idempotent (IF NOT EXISTS /
-- OR REPLACE / DROP ... IF EXISTS / a catalog-lookup DO block instead of
-- a guessed constraint name), so running this more than once, or after
-- part of it already ran, is safe. Order matters within this file (0077
-- alters tables 0076 creates; 0078 replaces functions 0076/0077 create;
-- 0081 redefines the organization_members insert policy 0079 last
-- defined; 0084 and 0085 are independent of everything before them and
-- safe to run standalone, but 0085 depends on 0084's tables existing
-- first) — paste and run the whole thing as one block.
--
-- NOTE: 0076-0084 are already applied to production (confirmed
-- 2026-07-26) — you only need to run the standalone
-- migrations/0085_knowledge_hub_due_dates_and_archive.sql file on its own.
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

-- ============================================================
-- 0082: Review escalation (skip-level co-sign) + JD builder
-- ============================================================

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
--
-- Hardened by 0083: the original `select ... into` calls here had no
-- `limit 1`, so any user who happens to match more than one
-- organization_members row (e.g. someone belonging to more than one org)
-- makes plpgsql throw "query returned more than one row". This function
-- is called from a permissive RLS policy on performance_reviews — Postgres
-- combines multiple permissive policies for the same command with OR, but
-- if ANY policy's USING expression throws while evaluating a row, the
-- ENTIRE query aborts, even for rows a different, already-passing policy
-- would have separately allowed. That's what broke the admin's Impact
-- Cycles roster (listReviewsForCycle) for every company in production
-- after this function first shipped. A helper used inside RLS must never
-- be allowed to raise, so this also wraps the body in an exception
-- handler that degrades to "not in the chain" (null) instead of failing
-- the calling query.
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
  where user_id = target_user_id
  limit 1;

  if v_org_id is null then
    return null;
  end if;

  select least(coalesce(review_escalation_levels, 1), 10) into v_max_level
  from public.organizations where id = v_org_id;

  while v_current is not null and v_level < coalesce(v_max_level, 1) loop
    v_level := v_level + 1;
    if v_current = auth.uid() then
      return v_level;
    end if;
    select manager_user_id into v_current
    from public.organization_members
    where user_id = v_current and organization_id = v_org_id
    limit 1;
  end loop;

  return null;
exception
  when others then
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

-- ============================================================
-- 0084: Knowledge Hub — enterprise LMS-lite
-- ============================================================

-- Knowledge Hub: HR-authored training documents, assigned to multiple
-- employees at once, completed via either a per-document MCQ exam scored
-- server-side or a simple "I confirm I've read this" attestation.
--
-- The hard problem this migration solves: with no service-role key, a
-- Next.js server action is exactly as RLS-bound as a raw PostgREST call
-- with the employee's own JWT — there is no privileged path. So the exam
-- answer key CANNOT live in a column an employee-readable table exposes
-- under any policy, no matter how the query is shaped. Fix: the correct
-- answer lives in its own table (knowledge_hub_exam_answer_keys) with NO
-- select policy for anyone except org admins — default-deny handles the
-- rest. Employees only ever see knowledge_hub_exam_questions (prompt +
-- options, no answer column exists there at all), and only via rows that
-- pass the assignment-scoped RLS policy below, which is enforced the same
-- way whether the caller is the app or a direct supabase-js call.
--
-- Exam scoring and completion writes go through SECURITY DEFINER RPCs
-- (get_knowledge_hub_exam_questions / submit_knowledge_hub_exam /
-- confirm_knowledge_hub_read), same "guarded state-transition write"
-- pattern as acknowledge_review (0076) — knowledge_hub_completions has NO
-- insert policy for authenticated at all, so the RPCs are the only path in.
--
-- Reuses is_org_admin_of_user / is_org_admin / is_org_member (0016) as-is —
-- no new RLS-embedded helper functions are introduced by this migration,
-- so the "SECURITY DEFINER helper used inside RLS must never throw" failure
-- mode (0083) doesn't apply here; every new policy uses either an existing
-- hardened helper or a plain inline exists()/equality check.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.knowledge_hub_content (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  mime_type text not null,
  completion_type text not null check (completion_type in ('exam', 'attestation')),
  passing_score_percent integer not null default 80 check (passing_score_percent between 1 and 100),
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No correct-answer column here, ever — see header note.
create table if not exists public.knowledge_hub_exam_questions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.knowledge_hub_content(id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- Physically separate table, deliberately: this is what makes the
-- leak-proofing real rather than an app-layer convention (same reasoning
-- as the self/manager assessment split in 0076).
create table if not exists public.knowledge_hub_exam_answer_keys (
  question_id uuid primary key references public.knowledge_hub_exam_questions(id) on delete cascade,
  correct_index integer not null
);

-- Mirrors assigned_assessments (0058) exactly.
create table if not exists public.knowledge_hub_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.knowledge_hub_content(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_user_id, content_id)
);

-- Append-only compliance/re-certification history — deliberately NOT
-- unique(employee_user_id, content_id) and NOT upsert-only like
-- assigned_assessments' completion semantics. Every attempt (exam retake or
-- repeat attestation) is its own row. No update/delete policy anywhere:
-- this is meant to be an immutable audit trail. Only insertable via the two
-- RPCs below — no direct insert policy for authenticated exists on this
-- table at all.
create table if not exists public.knowledge_hub_completions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.knowledge_hub_content(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('exam', 'attestation')),
  score_percent integer check (score_percent between 0 and 100),
  passed boolean not null,
  answers jsonb,
  completed_at timestamptz not null default now(),
  check (
    (method = 'exam' and score_percent is not null)
    or (method = 'attestation' and score_percent is null)
  )
);

alter table public.knowledge_hub_content enable row level security;
alter table public.knowledge_hub_exam_questions enable row level security;
alter table public.knowledge_hub_exam_answer_keys enable row level security;
alter table public.knowledge_hub_assignments enable row level security;
alter table public.knowledge_hub_completions enable row level security;

-- ============================================================
-- RLS: knowledge_hub_content
-- ============================================================

drop policy if exists "Org admins manage knowledge hub content" on public.knowledge_hub_content;
create policy "Org admins manage knowledge hub content"
  on public.knowledge_hub_content for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view their org's knowledge hub content" on public.knowledge_hub_content;
create policy "Org members can view their org's knowledge hub content"
  on public.knowledge_hub_content for select
  using (public.is_org_member(organization_id));

-- ============================================================
-- RLS: knowledge_hub_exam_questions (prompt + options only — safe)
-- ============================================================

drop policy if exists "Org admins manage knowledge hub exam questions" on public.knowledge_hub_exam_questions;
create policy "Org admins manage knowledge hub exam questions"
  on public.knowledge_hub_exam_questions for all
  using (
    exists (
      select 1 from public.knowledge_hub_content c
      where c.id = knowledge_hub_exam_questions.content_id
        and public.is_org_admin(c.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_hub_content c
      where c.id = knowledge_hub_exam_questions.content_id
        and public.is_org_admin(c.organization_id)
    )
  );

-- Assignment-scoped, not just org-membership-scoped — an employee can only
-- see questions for content actually assigned to them.
drop policy if exists "Assigned employees can view their exam questions" on public.knowledge_hub_exam_questions;
create policy "Assigned employees can view their exam questions"
  on public.knowledge_hub_exam_questions for select
  using (
    exists (
      select 1 from public.knowledge_hub_assignments a
      where a.content_id = knowledge_hub_exam_questions.content_id
        and a.employee_user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS: knowledge_hub_exam_answer_keys — org admins ONLY. No policy at all
-- for authenticated non-admins, by design: default-deny is the leak-proof.
-- ============================================================

drop policy if exists "Org admins manage knowledge hub answer keys" on public.knowledge_hub_exam_answer_keys;
create policy "Org admins manage knowledge hub answer keys"
  on public.knowledge_hub_exam_answer_keys for all
  using (
    exists (
      select 1 from public.knowledge_hub_exam_questions q
      join public.knowledge_hub_content c on c.id = q.content_id
      where q.id = knowledge_hub_exam_answer_keys.question_id
        and public.is_org_admin(c.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_hub_exam_questions q
      join public.knowledge_hub_content c on c.id = q.content_id
      where q.id = knowledge_hub_exam_answer_keys.question_id
        and public.is_org_admin(c.organization_id)
    )
  );

-- ============================================================
-- RLS: knowledge_hub_assignments (mirrors assigned_assessments exactly)
-- ============================================================

drop policy if exists "Org admins can assign knowledge hub content to their members" on public.knowledge_hub_assignments;
create policy "Org admins can assign knowledge hub content to their members"
  on public.knowledge_hub_assignments for insert
  with check (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Org admins can view knowledge hub assignments for their members" on public.knowledge_hub_assignments;
create policy "Org admins can view knowledge hub assignments for their members"
  on public.knowledge_hub_assignments for select
  using (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Org admins can remove knowledge hub assignments for their members" on public.knowledge_hub_assignments;
create policy "Org admins can remove knowledge hub assignments for their members"
  on public.knowledge_hub_assignments for delete
  using (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Employees can view their own knowledge hub assignments" on public.knowledge_hub_assignments;
create policy "Employees can view their own knowledge hub assignments"
  on public.knowledge_hub_assignments for select
  using (employee_user_id = auth.uid());

-- Multi-select bulk assign needs no new schema or RPC: the server action
-- inserts an array of rows in one .insert([...]) call; the with check above
-- is evaluated per row exactly like a single-row insert would be.

-- ============================================================
-- RLS: knowledge_hub_completions — SELECT only. No insert/update/delete
-- policy for authenticated exists on this table at all; every write goes
-- through submit_knowledge_hub_exam / confirm_knowledge_hub_read below.
-- ============================================================

drop policy if exists "Employees can view their own knowledge hub completions" on public.knowledge_hub_completions;
create policy "Employees can view their own knowledge hub completions"
  on public.knowledge_hub_completions for select
  using (employee_user_id = auth.uid());

drop policy if exists "Org admins can view knowledge hub completions for their members" on public.knowledge_hub_completions;
create policy "Org admins can view knowledge hub completions for their members"
  on public.knowledge_hub_completions for select
  using (public.is_org_admin_of_user(employee_user_id));

-- ============================================================
-- RPCs
-- ============================================================

-- Returns ONLY prompt+options+order — never touches
-- knowledge_hub_exam_answer_keys. Redundant with the RLS policy above by
-- design (defense in depth): even if this function were dropped, the
-- table's own RLS keeps a direct PostgREST call from an assigned employee
-- safe, and vice versa.
create or replace function public.get_knowledge_hub_exam_questions(p_content_id uuid)
returns table(question_id uuid, prompt text, options jsonb, order_index integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.knowledge_hub_content
    where id = p_content_id and completion_type = 'exam'
  ) then
    raise exception 'This content does not have an exam';
  end if;

  return query
    select q.id, q.prompt, q.options, q.order_index
    from public.knowledge_hub_exam_questions q
    where q.content_id = p_content_id
    order by q.order_index;
end;
$$;

revoke all on function public.get_knowledge_hub_exam_questions(uuid) from public;
grant execute on function public.get_knowledge_hub_exam_questions(uuid) to authenticated;

-- p_answers shape: [{"question_id": "<uuid>", "selected_index": 2}, ...]
-- Scores server-side against knowledge_hub_exam_answer_keys (readable here
-- because this function runs as its owner, not subject to that table's
-- RLS). Returns aggregate score/pass only — never per-question correctness
-- — so repeated legitimate retakes (recertification) can't be used to
-- reconstruct the key by elimination. 60s cooldown between attempts on the
-- same content narrows the brute-force window further for short exams.
create or replace function public.submit_knowledge_hub_exam(p_content_id uuid, p_answers jsonb)
returns table(score_percent integer, passed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_correct integer;
  v_passing integer;
  v_score integer;
  v_passed boolean;
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  select passing_score_percent into v_passing
  from public.knowledge_hub_content
  where id = p_content_id and completion_type = 'exam';

  if v_passing is null then
    raise exception 'This content does not have an exam';
  end if;

  if exists (
    select 1 from public.knowledge_hub_completions
    where content_id = p_content_id and employee_user_id = auth.uid()
      and completed_at > now() - interval '60 seconds'
  ) then
    raise exception 'Please wait before retrying this exam.';
  end if;

  select count(*) into v_total
  from public.knowledge_hub_exam_questions
  where content_id = p_content_id;

  if v_total = 0 then
    raise exception 'No questions found for this exam';
  end if;

  select count(distinct q.id) into v_correct
  from public.knowledge_hub_exam_questions q
  join public.knowledge_hub_exam_answer_keys k on k.question_id = q.id
  join jsonb_to_recordset(p_answers) as a(question_id uuid, selected_index integer)
    on a.question_id = q.id and a.selected_index = k.correct_index
  where q.content_id = p_content_id;

  v_score := round((v_correct::numeric / v_total::numeric) * 100);
  v_passed := v_score >= v_passing;

  insert into public.knowledge_hub_completions
    (content_id, employee_user_id, method, score_percent, passed, answers, completed_at)
  values
    (p_content_id, auth.uid(), 'exam', v_score, v_passed, p_answers, now());

  return query select v_score, v_passed;
end;
$$;

revoke all on function public.submit_knowledge_hub_exam(uuid, jsonb) from public;
grant execute on function public.submit_knowledge_hub_exam(uuid, jsonb) to authenticated;

create or replace function public.confirm_knowledge_hub_read(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.knowledge_hub_content
    where id = p_content_id and completion_type = 'attestation'
  ) then
    raise exception 'This content requires an exam, not a read confirmation';
  end if;

  insert into public.knowledge_hub_completions
    (content_id, employee_user_id, method, score_percent, passed, answers, completed_at)
  values
    (p_content_id, auth.uid(), 'attestation', null, true, null, now());
end;
$$;

revoke all on function public.confirm_knowledge_hub_read(uuid) from public;
grant execute on function public.confirm_knowledge_hub_read(uuid) to authenticated;

-- ============================================================
-- Storage: private bucket, signed-URL reads
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-hub-docs',
  'knowledge-hub-docs',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {organization_id}/{content_id}/{file_name}

drop policy if exists "Org admins can upload knowledge hub docs" on storage.objects;
create policy "Org admins can upload knowledge hub docs"
  on storage.objects for insert
  with check (bucket_id = 'knowledge-hub-docs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can update knowledge hub docs" on storage.objects;
create policy "Org admins can update knowledge hub docs"
  on storage.objects for update
  using (bucket_id = 'knowledge-hub-docs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can delete knowledge hub docs" on storage.objects;
create policy "Org admins can delete knowledge hub docs"
  on storage.objects for delete
  using (bucket_id = 'knowledge-hub-docs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

-- Any org member, not just specifically-assigned employees — the "is this
-- assigned to me" gate lives at the app layer (check knowledge_hub_
-- assignments before requesting a signed URL), matching how the rest of
-- this app separates "can physically open" from "shows up in your queue".
drop policy if exists "Org members can read their org's knowledge hub docs" on storage.objects;
create policy "Org members can read their org's knowledge hub docs"
  on storage.objects for select
  using (bucket_id = 'knowledge-hub-docs' and public.is_org_member(((storage.foldername(name))[1])::uuid));

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists knowledge_hub_content_org_idx on public.knowledge_hub_content (organization_id);
create index if not exists knowledge_hub_exam_questions_content_idx on public.knowledge_hub_exam_questions (content_id, order_index);
create index if not exists knowledge_hub_assignments_employee_idx on public.knowledge_hub_assignments (employee_user_id);
create index if not exists knowledge_hub_assignments_content_idx on public.knowledge_hub_assignments (content_id);
create index if not exists knowledge_hub_completions_employee_content_idx on public.knowledge_hub_completions (employee_user_id, content_id, completed_at desc);

-- ============================================================
-- 0085: Knowledge Hub due dates, archive flag, overdue reminders, video uploads
-- ============================================================

-- Knowledge Hub follow-up: optional due dates + overdue reminders, and an
-- archive flag for retiring content without destroying completion history.
--
-- Archiving, not deleting: knowledge_hub_content cascades to
-- knowledge_hub_completions on delete (0084), and completions are the
-- append-only compliance audit trail that migration was built to protect.
-- A real delete of a mistakenly-uploaded document would also silently wipe
-- out every real completion record for anyone who'd already finished it.
-- archived_at hides content from admin/employee lists while keeping the
-- row (and its history) intact — same posture as
-- organization_members.archived elsewhere in this schema.

alter table public.knowledge_hub_content
  add column if not exists due_date date,
  add column if not exists archived_at timestamptz;

alter table public.knowledge_hub_assignments
  add column if not exists last_reminder_sent_at timestamptz;

-- Adds video templates to the allowed upload types (0084 only allowed
-- Word/PDF/Excel/PPT). File size stays capped at 50MB — that's Supabase's
-- Free-plan global hard ceiling, not something this bucket config can
-- exceed on its own; it only actually changes once the project moves to
-- a paid plan.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]::text[]
where id = 'knowledge-hub-docs';

-- Same cron + SECURITY DEFINER + shared-secret pattern as
-- due_certification_reminders (0074) — SQL language, secret checked as a
-- WHERE filter (a bad secret just returns zero rows, not a throw; this
-- isn't called from an RLS policy so the "helper must never throw" rule
-- from 0083 doesn't apply here). Piggybacks on the existing daily
-- task-reminders cron rather than a new Vercel Cron entry — the Hobby plan
-- caps a project at 2 cron jobs and this one is already at that cap
-- (task-reminders, purge-deletions).
create or replace function public.due_knowledge_hub_reminders(secret text)
returns table(
  assignment_id uuid,
  user_id uuid,
  email text,
  full_name text,
  content_title text,
  due_date date,
  overdue boolean
)
language sql
security definer
set search_path = public
as $$
  select a.id, u.id, u.email, p.full_name, c.title, c.due_date, (c.due_date < current_date)
  from public.knowledge_hub_assignments a
  join public.knowledge_hub_content c on c.id = a.content_id and c.archived_at is null
  join auth.users u on u.id = a.employee_user_id
  left join public.profiles p on p.id = u.id
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and c.due_date is not null
    and c.due_date <= current_date + interval '7 days'
    and u.email is not null
    and not exists (
      select 1 from public.knowledge_hub_completions comp
      where comp.content_id = a.content_id and comp.employee_user_id = a.employee_user_id
    )
    and (a.last_reminder_sent_at is null or a.last_reminder_sent_at < now() - interval '3 days');
$$;

revoke all on function public.due_knowledge_hub_reminders(text) from public;
grant execute on function public.due_knowledge_hub_reminders(text) to anon, authenticated;

create or replace function public.mark_knowledge_hub_reminder_sent(secret text, target_assignment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.knowledge_hub_assignments set last_reminder_sent_at = now()
  where id = target_assignment_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_knowledge_hub_reminder_sent(text, uuid) from public;
grant execute on function public.mark_knowledge_hub_reminder_sent(text, uuid) to anon, authenticated;

create index if not exists knowledge_hub_content_due_date_idx on public.knowledge_hub_content (due_date) where due_date is not null;
