-- ROLLBACK for migration 0204 (competency assessments). Emergency use only.
-- Removes every assessment, answer, result, snapshot and company setting created by 0204. Nothing from 0203 or earlier is touched.
-- Copy the data first if you need it, for example:
--   select * from public.competency_assessment_results;
drop trigger if exists competency_results_integrity on public.competency_assessment_results;
drop trigger if exists competency_responses_integrity on public.competency_assessment_responses;
drop trigger if exists competency_assessments_integrity on public.competency_assessments;
drop table if exists public.competency_assessment_results cascade;
drop table if exists public.competency_assessment_responses cascade;
drop table if exists public.competency_assessment_items cascade;
drop table if exists public.competency_assessments cascade;
drop table if exists public.competency_definition_versions cascade;
drop table if exists public.competency_assessment_settings cascade;
drop function if exists public.enforce_competency_assessment_integrity();
drop function if exists public.purge_expired_competency_assessment_answers(uuid);
drop function if exists public.competency_assessment_self_start_allowed(uuid);
drop function if exists public.record_competency_definition_version(uuid, text, text, text, text, text, jsonb, text);
drop function if exists public.competency_definition_fingerprint(text, text, jsonb);
