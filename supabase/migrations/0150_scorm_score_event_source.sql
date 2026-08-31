-- Closes a gap found during live verification of 0147+0149: the
-- knowledge_hub_completions trigger (0147) hardcodes source =
-- 'knowledge_hub_exam' for every completion with a non-null score,
-- regardless of method — so a real SCORM completion, verified live to flow
-- correctly all the way through to the Employee Intelligence Timeline,
-- shows up there mislabeled as "Knowledge Hub Exam" rather than as a SCORM
-- completion. The method itself was still captured (in the event's
-- metadata jsonb), just not surfaced in the field the UI actually reads
-- labels from. lib/scoring/scoreEvents.ts's ScoreEventSource type already
-- reserved 'scorm_completion' for exactly this ("added in Phase 3 via a
-- one-line ALTER, not a redesign") and messages/{en,ar}.json's
-- scoreEventSources namespace already has a translated label for it — this
-- migration is that one-line ALTER, finishing what was already planned for
-- rather than a new addition.

do $$
declare
  existing_constraint text;
begin
  select tc.constraint_name into existing_constraint
  from information_schema.table_constraints tc
  join information_schema.check_constraints cc
    on cc.constraint_name = tc.constraint_name
    and cc.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'score_events'
    and tc.constraint_type = 'CHECK'
    and cc.check_clause like '%gap_analysis%'
    and cc.check_clause like '%flight_risk%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.score_events drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.score_events
  add constraint score_events_source_check
  check (source in (
    'gap_analysis', 'career_health_snapshot',
    'performance_review_self', 'performance_review_manager',
    'performance_review_competency_self', 'performance_review_competency_manager',
    'knowledge_hub_exam', 'assessment_result', 'case_study_exercise', 'resume_analysis',
    'flight_risk', 'succession_fit', 'scorm_completion'
  ));

create or replace function public.trg_score_event_knowledge_hub_completions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_source text;
begin
  if new.score_percent is null then
    return new;
  end if;
  v_source := case when new.method = 'scorm' then 'scorm_completion' else 'knowledge_hub_exam' end;
  select organization_id into v_org from public.knowledge_hub_content where id = new.content_id;
  perform public.record_score_event(v_org, new.employee_user_id, v_source, '', new.score_percent, '0_100',
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

-- Backfill: re-label the specific rows this trigger already wrote for real
-- SCORM completions before this migration existed (verified live during
-- Phase 3 testing) — an update, not an insert, so it's safe to run more
-- than once (the where clause simply matches zero rows on a second run).
update public.score_events se
set source = 'scorm_completion'
from public.knowledge_hub_completions khc
where se.source_table = 'knowledge_hub_completions'
  and se.source_id = khc.id
  and se.source = 'knowledge_hub_exam'
  and khc.method = 'scorm';
