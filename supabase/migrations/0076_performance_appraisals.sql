-- Structured performance appraisal — upgrades the single manager-entered
-- performance_rating (0068) into a real review process: named cycles,
-- separate self-assessment and manager-assessment records, goals, and an
-- employee acknowledgment step. organization_members.performance_rating
-- itself is left untouched and still drives every existing consumer
-- (Scorecard, Analytics, succession/HiPo AI prompts) — submit_manager_
-- assessment below writes into it automatically when a manager assessment
-- is submitted, so nothing downstream needs to change to pick up real
-- appraisal data instead of the old ad-hoc rating.
--
-- "Manager" in this app still means "org admin" — there is no third role
-- between admin and member (organization_members.role is only
-- 'admin'/'member'; manager_user_id from 0072 is a reporting-line hint, not
-- a permission grant). So the manager-assessment side of a review is
-- authored by an org admin, same as the existing performance_rating field
-- already was — this isn't a new restriction, just carried forward.

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

-- One row per employee per cycle — the "envelope" tracking where a review
-- stands. The actual content lives in the two child tables below, kept
-- deliberately separate (not just extra columns here) so that an employee's
-- write access to their own self-assessment can never structurally reach
-- the manager-assessment columns, even via a raw REST call that bypasses
-- the app's server actions — RLS is table-level in this schema's existing
-- style (see every other migration), so two tables is what makes the
-- boundary real instead of just app-layer convention.
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

-- Cycles: admins manage; any org member can see cycles exist (so an
-- employee's own review page can find "H1 2026 is open" context).
drop policy if exists "Admins manage review cycles" on public.performance_review_cycles;
create policy "Admins manage review cycles"
  on public.performance_review_cycles for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view their cycles" on public.performance_review_cycles;
create policy "Org members can view their cycles"
  on public.performance_review_cycles for select
  using (public.is_org_member(organization_id));

-- Reviews: admins manage the envelope (create rows, close things out);
-- employees can only ever SELECT their own row directly — every write to a
-- review (self-submit, manager-submit, acknowledge) goes through one of the
-- three functions below instead, so a status transition is always validated
-- server-side rather than settable by whoever has write access to the row.
drop policy if exists "Admins manage reviews" on public.performance_reviews;
create policy "Admins manage reviews"
  on public.performance_reviews for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Employees can view their own review" on public.performance_reviews;
create policy "Employees can view their own review"
  on public.performance_reviews for select
  using (employee_user_id = auth.uid());

-- Self/manager assessment child tables: SELECT only for the two parties who
-- should ever see them (the employee themselves, and org admins) — no
-- direct INSERT/UPDATE policy on either table for anyone. All writes go
-- through submit_self_assessment / submit_manager_assessment, which run
-- SECURITY DEFINER and bypass RLS entirely, the same pattern used
-- throughout this schema (is_org_admin, admin_schedule_employee_data_deletion,
-- etc.) for "a specific, narrow, validated state transition."
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

-- Goals: admin-set (matches performance_rating's existing "manager writes,
-- employee reads" posture), employee can view their own.
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

-- Ensures every current member of an org has a review row for a cycle —
-- idempotent (on conflict do nothing), callable repeatedly as people join.
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

  -- Only advances status forward from the starting point — resubmitting a
  -- self-assessment after the manager has already submitted theirs
  -- shouldn't regress the review's overall status.
  update public.performance_reviews
    set status = 'self_submitted'
    where id = target_review_id and status = 'not_started';
end;
$$;

revoke all on function public.submit_self_assessment(uuid, integer, text) from public;
grant execute on function public.submit_self_assessment(uuid, integer, text) to authenticated;

-- Also syncs the org-wide performance_rating field (0068) so every existing
-- consumer (Company Scorecard, Workforce Analytics, succession/HiPo AI
-- prompts) automatically reflects the latest formal appraisal without
-- needing to know this review system exists.
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
