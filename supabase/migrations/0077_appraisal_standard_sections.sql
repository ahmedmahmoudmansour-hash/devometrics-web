-- Rounds Impact Cycles out to match the standard mid/large-company appraisal
-- shape (SHRM/industry-common sections): goal-vs-KPI review (backward AND
-- forward), a labeled competency rating scale, a development plan, and a
-- dual sign-off/conclusion — on top of 0076's cycles/self-assessment/
-- manager-assessment/goals/acknowledgment foundation.
--
-- "Past goals" needs no new schema — the previous cycle's
-- performance_review_goals rows already exist and are simply queried by
-- employee + earlier cycle from the app layer.

-- KPI fields on Focus Areas: optional, since a qualitative goal is still a
-- legitimate goal — not every Focus Area needs a hard number.
alter table public.performance_review_goals
  add column if not exists target text,
  add column if not exists actual text;

-- Manager's per-dimension competency ratings for this cycle — reuses the
-- same 8 dimensions as Gap Analysis (Technical Skills, Leadership, etc.) on
-- purpose, but this is a DIFFERENT signal: the manager's judgment for this
-- specific review period, not Gap Analysis's measured/AI-scored baseline.
-- Two numbers per dimension per person that can legitimately differ is
-- fine as long as each is clearly labeled where it's shown — same posture
-- already established between performance_rating and Career Health Score.
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

-- Development needs lives alongside the manager's written feedback — same
-- author, same table, distinct field: feedback is "how this cycle went",
-- development_needs is "what to build to grow from here" (the standard
-- template's separate Development Areas / Development Plan sections).
alter table public.performance_review_manager_assessments
  add column if not exists development_needs text;

-- Conclusion + dual sign-off: employee_acknowledged_at (0076) is already the
-- employee's signature. This adds the manager's own explicit signature —
-- writing a closing conclusion is a distinct act from submitting the
-- Perspective, matching real appraisal practice where the write-up often
-- gets finalized after the actual conversation happens.
-- Looked up from information_schema rather than assumed — same reasoning as
-- 0069's milestones-status fix: "very likely performance_reviews_status_check"
-- isn't good enough for a migration run once against a real database.
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

-- Manager's formal close — requires the manager assessment to already be in
-- (closing with no assessment on record isn't a real appraisal). Doesn't
-- require employee acknowledgment first: real processes vary on ordering,
-- and forcing one order here would just make the app fight how an admin
-- actually wants to run their cycle.
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

-- Manager sets/updates a competency rating for one dimension — upsert, same
-- SECURITY DEFINER write-gate pattern as everything else in this schema.
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
