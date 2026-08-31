-- 0147: Unified score-tracking layer ("Talent Intelligence" foundation).
--
-- Every scored/rated signal an employee produces today lives in a separate,
-- unrelated table (gap_analyses, performance reviews, Knowledge Hub exams,
-- flight risk, succession fit, ...) with no shared query surface. This adds
-- one append-mostly table, score_events, fed exclusively by triggers on the
-- existing source tables -- no existing TypeScript write path changes, so
-- no future write path can accidentally bypass it.
--
-- Design notes (see the approved plan for full rationale):
-- * raw_value + scale (never force-normalized) -- a 1-5 rating and a 0-100
--   score are never silently averaged together.
-- * source is deliberately scoped to numeric/rated signals only. A future
--   non-numeric fact (promotion, manager change) gets its own sibling table
--   later, not shoehorned in here.
-- * visible_to_employee/visible_to_manager are set per-source by each
--   trigger, not one blanket rule -- flight_risk and succession_fit must
--   stay exactly as invisible to the employee/manager as they are today
--   (see lib/organizations/teamPulse.ts's own comment on why).
-- * Every trigger's exception handler logs to score_event_failures instead
--   of swallowing silently -- a bug here must never be able to block the
--   real write (a review must always save), but it must also never go
--   undetected forever.

create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in (
    'gap_analysis', 'career_health_snapshot',
    'performance_review_self', 'performance_review_manager',
    'performance_review_competency_self', 'performance_review_competency_manager',
    'knowledge_hub_exam', 'assessment_result', 'case_study_exercise', 'resume_analysis',
    'flight_risk', 'succession_fit'
  )),
  dimension text not null default '',
  raw_value numeric not null,
  scale text not null check (scale in ('0_100', '1_5')),
  recorded_at timestamptz not null default now(),
  source_table text not null,
  source_id uuid not null,
  visible_to_employee boolean not null default true,
  visible_to_manager boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.score_events enable row level security;

drop policy if exists "Score events visible per source rules" on public.score_events;
create policy "Score events visible per source rules"
  on public.score_events for select
  using (
    (organization_id is not null and public.is_org_admin(organization_id))
    or (visible_to_employee and employee_user_id = auth.uid())
    or (visible_to_manager and public.is_manager_of_user(employee_user_id))
  );

create index if not exists score_events_employee_recorded_idx on public.score_events (employee_user_id, source, recorded_at desc);
create index if not exists score_events_org_recorded_idx on public.score_events (organization_id, source, recorded_at desc);
create index if not exists score_events_source_lookup_idx on public.score_events (source_table, source_id);

-- Failure log -- never silently lose intelligence data. Platform-admin only
-- (public.is_admin(), migration 0013); no employee/org-admin visibility.
create table if not exists public.score_event_failures (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid,
  error_detail text not null,
  occurred_at timestamptz not null default now()
);

alter table public.score_event_failures enable row level security;

drop policy if exists "Platform admins view score event failures" on public.score_event_failures;
create policy "Platform admins view score event failures"
  on public.score_event_failures for select
  using (public.is_admin());

-- Shared insert helper -- every trigger below calls this instead of
-- inserting directly, so the "never break the real write" exception
-- handling lives in exactly one place.
create or replace function public.record_score_event(
  p_organization_id uuid,
  p_employee_user_id uuid,
  p_source text,
  p_dimension text,
  p_raw_value numeric,
  p_scale text,
  p_recorded_at timestamptz,
  p_source_table text,
  p_source_id uuid,
  p_visible_to_employee boolean,
  p_visible_to_manager boolean,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.score_events (
    organization_id, employee_user_id, source, dimension, raw_value, scale,
    recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata
  ) values (
    p_organization_id, p_employee_user_id, p_source, p_dimension, p_raw_value, p_scale,
    coalesce(p_recorded_at, now()), p_source_table, p_source_id, p_visible_to_employee, p_visible_to_manager, coalesce(p_metadata, '{}'::jsonb)
  );
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail)
    values (p_source_table, p_source_id, sqlerrm);
  exception when others then null;
  end;
end;
$$;

-- gap_analyses/assessment_results/resume_analyses/case_study_exercise_attempts
-- have no organization_id column -- resolve it through organization_members.
-- limit 1 per the migration skill's warning (a user could in theory hold two
-- memberships); stable, security definer so it works inside RLS-governed
-- triggers regardless of caller.
create or replace function public.org_id_for_user(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.organization_members where user_id = p_user_id limit 1;
$$;

-- ============================================================
-- Shape A: simple append, one new row per insert
-- ============================================================

create or replace function public.trg_score_event_gap_analyses()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_dim jsonb;
begin
  v_org := public.org_id_for_user(new.user_id);
  perform public.record_score_event(v_org, new.user_id, 'gap_analysis', '', new.career_health_score, '0_100',
    new.created_at, 'gap_analyses', new.id, true, true, jsonb_build_object('target_role', new.target_role));
  for v_dim in select * from jsonb_array_elements(coalesce(new.competencies, '[]'::jsonb))
  loop
    if (v_dim ->> 'dimension') is not null and (v_dim ->> 'currentLevel') is not null then
      perform public.record_score_event(v_org, new.user_id, 'gap_analysis', v_dim ->> 'dimension',
        (v_dim ->> 'currentLevel')::numeric, '0_100', new.created_at, 'gap_analyses', new.id, true, true, '{}'::jsonb);
    end if;
  end loop;
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('gap_analyses', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_gap_analyses on public.gap_analyses;
create trigger score_event_gap_analyses after insert on public.gap_analyses
  for each row execute function public.trg_score_event_gap_analyses();

create or replace function public.trg_score_event_career_health_snapshots()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.record_score_event(public.org_id_for_user(new.user_id), new.user_id, 'career_health_snapshot', '',
    new.score, '0_100', new.recorded_at, 'career_health_snapshots', new.id, true, true, '{}'::jsonb);
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('career_health_snapshots', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_career_health_snapshots on public.career_health_snapshots;
create trigger score_event_career_health_snapshots after insert on public.career_health_snapshots
  for each row execute function public.trg_score_event_career_health_snapshots();

create or replace function public.trg_score_event_assessment_results()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.record_score_event(public.org_id_for_user(new.user_id), new.user_id, 'assessment_result', '',
    new.score, '0_100', new.completed_at, 'assessment_results', new.id, true, true,
    jsonb_build_object('assessment_slug', new.assessment_slug));
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('assessment_results', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_assessment_results on public.assessment_results;
create trigger score_event_assessment_results after insert on public.assessment_results
  for each row execute function public.trg_score_event_assessment_results();

-- Three peer scores, no single "whole" score for this source (unlike gap
-- analysis's career_health_score) -- emitted as three dimension rows.
create or replace function public.trg_score_event_resume_analyses()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  v_org := public.org_id_for_user(new.user_id);
  perform public.record_score_event(v_org, new.user_id, 'resume_analysis', 'ats', new.ats_score, '0_100',
    new.created_at, 'resume_analyses', new.id, true, true, '{}'::jsonb);
  perform public.record_score_event(v_org, new.user_id, 'resume_analysis', 'achievement', new.achievement_score, '0_100',
    new.created_at, 'resume_analyses', new.id, true, true, '{}'::jsonb);
  perform public.record_score_event(v_org, new.user_id, 'resume_analysis', 'overall', new.overall_score, '0_100',
    new.created_at, 'resume_analyses', new.id, true, true, '{}'::jsonb);
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('resume_analyses', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_resume_analyses on public.resume_analyses;
create trigger score_event_resume_analyses after insert on public.resume_analyses
  for each row execute function public.trg_score_event_resume_analyses();

-- Admin-only visibility, matching this table's existing posture exactly
-- (see teamPulse.ts's comment on why a manager must not see a raw risk
-- score on their own report).
create or replace function public.trg_score_event_flight_risk()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.record_score_event(new.organization_id, new.employee_user_id, 'flight_risk', '', new.score, '0_100',
    new.created_at, 'employee_flight_risk_scores', new.id, false, false,
    jsonb_build_object('confidence', new.confidence));
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('employee_flight_risk_scores', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_flight_risk on public.employee_flight_risk_scores;
create trigger score_event_flight_risk after insert on public.employee_flight_risk_scores
  for each row execute function public.trg_score_event_flight_risk();

-- knowledge_hub_completions has no organization_id of its own -- resolved
-- via its parent content row. Attestation-method completions have a null
-- score_percent and deliberately emit no event (nothing numeric to track).
create or replace function public.trg_score_event_knowledge_hub_completions()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if new.score_percent is null then
    return new;
  end if;
  select organization_id into v_org from public.knowledge_hub_content where id = new.content_id;
  perform public.record_score_event(v_org, new.employee_user_id, 'knowledge_hub_exam', '', new.score_percent, '0_100',
    new.completed_at, 'knowledge_hub_completions', new.id, true, true,
    jsonb_build_object('passed', new.passed, 'method', new.method));
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('knowledge_hub_completions', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_knowledge_hub_completions on public.knowledge_hub_completions;
create trigger score_event_knowledge_hub_completions after insert on public.knowledge_hub_completions
  for each row execute function public.trg_score_event_knowledge_hub_completions();

-- ============================================================
-- Shape C: score arrives via a later UPDATE, not the INSERT
-- ============================================================

create or replace function public.trg_score_event_case_study_attempts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.score is not null and (tg_op = 'INSERT' or old.score is distinct from new.score) then
    perform public.record_score_event(public.org_id_for_user(new.user_id), new.user_id, 'case_study_exercise', '',
      new.score, '0_100', coalesce(new.submitted_at, now()), 'case_study_exercise_attempts', new.id, true, true,
      jsonb_build_object('exercise_slug', new.exercise_slug));
  end if;
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('case_study_exercise_attempts', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_case_study_attempts on public.case_study_exercise_attempts;
create trigger score_event_case_study_attempts after insert or update on public.case_study_exercise_attempts
  for each row execute function public.trg_score_event_case_study_attempts();

-- ============================================================
-- Shape B: upsert, log only on genuine value change
-- ============================================================

create or replace function public.trg_score_event_perf_review_self()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_emp uuid;
begin
  if new.rating is not null and (tg_op = 'INSERT' or old.rating is distinct from new.rating) then
    select organization_id, employee_user_id into v_org, v_emp from public.performance_reviews where id = new.review_id;
    if v_emp is not null then
      perform public.record_score_event(v_org, v_emp, 'performance_review_self', '', new.rating, '1_5',
        coalesce(new.submitted_at, now()), 'performance_review_self_assessments', new.review_id, true, true, '{}'::jsonb);
    end if;
  end if;
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('performance_review_self_assessments', new.review_id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_perf_review_self on public.performance_review_self_assessments;
create trigger score_event_perf_review_self after insert or update on public.performance_review_self_assessments
  for each row execute function public.trg_score_event_perf_review_self();

create or replace function public.trg_score_event_perf_review_manager()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_emp uuid;
begin
  if new.rating is not null and (tg_op = 'INSERT' or old.rating is distinct from new.rating) then
    select organization_id, employee_user_id into v_org, v_emp from public.performance_reviews where id = new.review_id;
    if v_emp is not null then
      perform public.record_score_event(v_org, v_emp, 'performance_review_manager', '', new.rating, '1_5',
        coalesce(new.submitted_at, now()), 'performance_review_manager_assessments', new.review_id, true, true, '{}'::jsonb);
    end if;
  end if;
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('performance_review_manager_assessments', new.review_id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_perf_review_manager on public.performance_review_manager_assessments;
create trigger score_event_perf_review_manager after insert or update on public.performance_review_manager_assessments
  for each row execute function public.trg_score_event_perf_review_manager();

-- Two independent emissions per row: self_rating and rating (manager) can
-- each arrive/change on their own schedule (migration 0132's comment: a row
-- can exist with only a self_rating and no manager rating yet). No
-- created_at/updated_at column on this table (per its 0077/0103 schema) --
-- recorded_at is genuinely "now" for both, not backdated to review time.
create or replace function public.trg_score_event_perf_review_competency()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_emp uuid;
begin
  select organization_id, employee_user_id into v_org, v_emp from public.performance_reviews where id = new.review_id;
  if v_emp is null then
    return new;
  end if;

  if new.rating is not null and (tg_op = 'INSERT' or old.rating is distinct from new.rating) then
    perform public.record_score_event(v_org, v_emp, 'performance_review_competency_manager', new.dimension, new.rating, '1_5',
      now(), 'performance_review_competency_ratings', new.id, true, true, '{}'::jsonb);
  end if;

  if new.self_rating is not null and (tg_op = 'INSERT' or old.self_rating is distinct from new.self_rating) then
    perform public.record_score_event(v_org, v_emp, 'performance_review_competency_self', new.dimension, new.self_rating, '1_5',
      now(), 'performance_review_competency_ratings', new.id, true, true, '{}'::jsonb);
  end if;

  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('performance_review_competency_ratings', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_perf_review_competency on public.performance_review_competency_ratings;
create trigger score_event_perf_review_competency after insert or update on public.performance_review_competency_ratings
  for each row execute function public.trg_score_event_perf_review_competency();

-- ============================================================
-- Shape D: jsonb blob overwritten on regen, fans out to many rows
-- ============================================================

-- Admin-only visibility, same reasoning as flight risk. Deliberately never
-- deletes prior events for the same role on a later regeneration -- the
-- trend across repeated regenerations is exactly what this layer preserves.
create or replace function public.trg_score_event_succession_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_candidate jsonb;
begin
  if new.report is null or old.report is not distinct from new.report then
    return new;
  end if;
  for v_candidate in select * from jsonb_array_elements(coalesce(new.report -> 'candidates', '[]'::jsonb))
  loop
    if (v_candidate ->> 'userId') is not null and (v_candidate ->> 'fitScore') is not null then
      perform public.record_score_event(new.organization_id, (v_candidate ->> 'userId')::uuid, 'succession_fit', '',
        (v_candidate ->> 'fitScore')::numeric, '0_100', coalesce(new.generated_at, now()), 'succession_roles', new.id,
        false, false, jsonb_build_object('role_title', new.title));
    end if;
  end loop;
  return new;
exception when others then
  begin
    insert into public.score_event_failures (source_table, source_id, error_detail) values ('succession_roles', new.id, sqlerrm);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists score_event_succession_roles on public.succession_roles;
create trigger score_event_succession_roles after update of report on public.succession_roles
  for each row execute function public.trg_score_event_succession_roles();

-- ============================================================
-- Read helper: "latest event per employee" needs DISTINCT ON, which
-- postgrest's query builder can't express -- one small RPC instead of
-- hauling every historical row client-side to dedupe in TypeScript (the
-- exact pattern this whole layer replaces in aggregate.ts/scorecard/
-- teamPulse.ts). security invoker (the explicit form of Postgres's own
-- default) is deliberate here, unlike every function above -- this is a
-- plain read and must respect the calling user's own RLS visibility on
-- score_events, not bypass it.
-- ============================================================

create or replace function public.latest_score_events(p_employee_user_ids uuid[], p_source text, p_dimension text default '')
returns setof public.score_events
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (employee_user_id) *
  from public.score_events
  where employee_user_id = any(p_employee_user_ids)
    and source = p_source
    and dimension = p_dimension
  order by employee_user_id, recorded_at desc;
$$;

-- Whole-org variant: one row per (employee, source) whole-score event —
-- backs WorkforceRow.latestScores, a cross-source snapshot per employee.
-- Restricted to dimension = '' (the summary numbers, not every granular
-- competency dimension) so this stays cheap at org scale.
create or replace function public.latest_score_events_by_source(p_employee_user_ids uuid[])
returns setof public.score_events
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (employee_user_id, source) *
  from public.score_events
  where employee_user_id = any(p_employee_user_ids)
    and dimension = ''
  order by employee_user_id, source, recorded_at desc;
$$;
