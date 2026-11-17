-- ROLLBACK for migration 0210: removes the record of assessment conditions (the table, its rules and two functions).
-- Assessments and their results are not touched; the pages simply stop showing the conditions.
drop table if exists public.assessment_integrity;
drop function if exists public.assessment_integrity_before_insert();
drop function if exists public.assessment_integrity_guard();
