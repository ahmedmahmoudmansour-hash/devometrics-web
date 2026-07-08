-- Case study layer on top of the existing Likert self-report assessments.
-- Deliberately stored on the same assessment_results row rather than a new
-- table: a case study response is additional color on one taking-session's
-- result, not an independent record. case_study_responses holds the raw
-- per-scenario answers; case_study_insight is the synthesized narrative
-- surfaced alongside the existing score/band.
alter table public.assessment_results
  add column if not exists case_study_responses jsonb not null default '[]'::jsonb,
  add column if not exists case_study_insight text;
