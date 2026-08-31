-- 0148: One-time backfill of score_events from every source table's
-- existing historical rows -- depends on 0147 (table + guard columns must
-- exist first). Every insert is guarded by `where not exists (...)` on
-- (source_table, source_id[, dimension]), so running this file twice
-- inserts zero additional rows the second time.

-- gap_analyses: one whole-score row + one row per competency dimension.
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select public.org_id_for_user(ga.user_id), ga.user_id, 'gap_analysis', '', ga.career_health_score, '0_100', ga.created_at, 'gap_analyses', ga.id, true, true, jsonb_build_object('target_role', ga.target_role)
from public.gap_analyses ga
where not exists (
  select 1 from public.score_events se where se.source_table = 'gap_analyses' and se.source_id = ga.id and se.dimension = ''
);

insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select public.org_id_for_user(ga.user_id), ga.user_id, 'gap_analysis', dim ->> 'dimension', (dim ->> 'currentLevel')::numeric, '0_100', ga.created_at, 'gap_analyses', ga.id, true, true, '{}'::jsonb
from public.gap_analyses ga, jsonb_array_elements(coalesce(ga.competencies, '[]'::jsonb)) as dim
where (dim ->> 'dimension') is not null and (dim ->> 'currentLevel') is not null
  and not exists (
    select 1 from public.score_events se where se.source_table = 'gap_analyses' and se.source_id = ga.id and se.dimension = dim ->> 'dimension'
  );

-- career_health_snapshots
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select public.org_id_for_user(chs.user_id), chs.user_id, 'career_health_snapshot', '', chs.score, '0_100', chs.recorded_at, 'career_health_snapshots', chs.id, true, true, '{}'::jsonb
from public.career_health_snapshots chs
where not exists (
  select 1 from public.score_events se where se.source_table = 'career_health_snapshots' and se.source_id = chs.id
);

-- assessment_results
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select public.org_id_for_user(ar.user_id), ar.user_id, 'assessment_result', '', ar.score, '0_100', ar.completed_at, 'assessment_results', ar.id, true, true, jsonb_build_object('assessment_slug', ar.assessment_slug)
from public.assessment_results ar
where not exists (
  select 1 from public.score_events se where se.source_table = 'assessment_results' and se.source_id = ar.id
);

-- resume_analyses: three dimension rows (ats/achievement/overall), no whole-score row.
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select public.org_id_for_user(ra.user_id), ra.user_id, 'resume_analysis', d.dim, d.val, '0_100', ra.created_at, 'resume_analyses', ra.id, true, true, '{}'::jsonb
from public.resume_analyses ra
cross join lateral (values ('ats', ra.ats_score), ('achievement', ra.achievement_score), ('overall', ra.overall_score)) as d(dim, val)
where not exists (
  select 1 from public.score_events se where se.source_table = 'resume_analyses' and se.source_id = ra.id and se.dimension = d.dim
);

-- employee_flight_risk_scores (admin-only visibility, matches the trigger)
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select efrs.organization_id, efrs.employee_user_id, 'flight_risk', '', efrs.score, '0_100', efrs.created_at, 'employee_flight_risk_scores', efrs.id, false, false, jsonb_build_object('confidence', efrs.confidence)
from public.employee_flight_risk_scores efrs
where not exists (
  select 1 from public.score_events se where se.source_table = 'employee_flight_risk_scores' and se.source_id = efrs.id
);

-- knowledge_hub_completions (exam method only -- attestations have no score_percent)
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select khc_content.organization_id, khc.employee_user_id, 'knowledge_hub_exam', '', khc.score_percent, '0_100', khc.completed_at, 'knowledge_hub_completions', khc.id, true, true, jsonb_build_object('passed', khc.passed, 'method', khc.method)
from public.knowledge_hub_completions khc
join public.knowledge_hub_content khc_content on khc_content.id = khc.content_id
where khc.score_percent is not null
  and not exists (
    select 1 from public.score_events se where se.source_table = 'knowledge_hub_completions' and se.source_id = khc.id
  );

-- case_study_exercise_attempts (submitted/scored attempts only)
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select public.org_id_for_user(cse.user_id), cse.user_id, 'case_study_exercise', '', cse.score, '0_100', coalesce(cse.submitted_at, cse.created_at), 'case_study_exercise_attempts', cse.id, true, true, jsonb_build_object('exercise_slug', cse.exercise_slug)
from public.case_study_exercise_attempts cse
where cse.score is not null
  and not exists (
    select 1 from public.score_events se where se.source_table = 'case_study_exercise_attempts' and se.source_id = cse.id
  );

-- performance_review_self_assessments
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select pr.organization_id, pr.employee_user_id, 'performance_review_self', '', prsa.rating, '1_5', coalesce(prsa.submitted_at, prsa.updated_at), 'performance_review_self_assessments', prsa.review_id, true, true, '{}'::jsonb
from public.performance_review_self_assessments prsa
join public.performance_reviews pr on pr.id = prsa.review_id
where prsa.rating is not null
  and not exists (
    select 1 from public.score_events se where se.source_table = 'performance_review_self_assessments' and se.source_id = prsa.review_id
  );

-- performance_review_manager_assessments
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select pr.organization_id, pr.employee_user_id, 'performance_review_manager', '', prma.rating, '1_5', coalesce(prma.submitted_at, prma.updated_at), 'performance_review_manager_assessments', prma.review_id, true, true, '{}'::jsonb
from public.performance_review_manager_assessments prma
join public.performance_reviews pr on pr.id = prma.review_id
where prma.rating is not null
  and not exists (
    select 1 from public.score_events se where se.source_table = 'performance_review_manager_assessments' and se.source_id = prma.review_id
  );

-- performance_review_competency_ratings: manager rating and self_rating are
-- independent columns on the same row -- backfilled as two separate passes,
-- matching the trigger's two independent emissions.
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select pr.organization_id, pr.employee_user_id, 'performance_review_competency_manager', prcr.dimension, prcr.rating, '1_5', now(), 'performance_review_competency_ratings', prcr.id, true, true, '{}'::jsonb
from public.performance_review_competency_ratings prcr
join public.performance_reviews pr on pr.id = prcr.review_id
where prcr.rating is not null
  and not exists (
    select 1 from public.score_events se where se.source_table = 'performance_review_competency_ratings' and se.source_id = prcr.id and se.source = 'performance_review_competency_manager'
  );

insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select pr.organization_id, pr.employee_user_id, 'performance_review_competency_self', prcr.dimension, prcr.self_rating, '1_5', now(), 'performance_review_competency_ratings', prcr.id, true, true, '{}'::jsonb
from public.performance_review_competency_ratings prcr
join public.performance_reviews pr on pr.id = prcr.review_id
where prcr.self_rating is not null
  and not exists (
    select 1 from public.score_events se where se.source_table = 'performance_review_competency_ratings' and se.source_id = prcr.id and se.source = 'performance_review_competency_self'
  );

-- succession_roles: fan out each stored report's candidates. One backfill
-- pass over whatever report is currently stored per role (there is no
-- historical log of past regenerations to backfill from -- only the latest
-- report jsonb has ever been persisted; going forward the trigger captures
-- every future regeneration).
insert into public.score_events (organization_id, employee_user_id, source, dimension, raw_value, scale, recorded_at, source_table, source_id, visible_to_employee, visible_to_manager, metadata)
select sr.organization_id, (cand ->> 'userId')::uuid, 'succession_fit', '', (cand ->> 'fitScore')::numeric, '0_100', coalesce(sr.generated_at, sr.created_at), 'succession_roles', sr.id, false, false, jsonb_build_object('role_title', sr.title)
from public.succession_roles sr, jsonb_array_elements(coalesce(sr.report -> 'candidates', '[]'::jsonb)) as cand
where sr.report is not null and (cand ->> 'userId') is not null and (cand ->> 'fitScore') is not null
  and not exists (
    select 1 from public.score_events se
    where se.source_table = 'succession_roles' and se.source_id = sr.id and se.employee_user_id = (cand ->> 'userId')::uuid
  );
