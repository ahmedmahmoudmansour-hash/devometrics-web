-- ============================================================================
-- DEVOMETRICS: READ-ONLY MIGRATION AUDIT, migrations 0203 to 0211
-- Why: a migration can look applied and silently not take effect (this happened to 0205, found 2026-11-23). This lists every table,
-- policy, function and trigger that migrations 0203-0211 are expected to leave in the database, and reports any that are missing.
-- It changes NOTHING. Paste into the Supabase SQL Editor (new empty tab) and Run. Generated from the migration files, in order, so an
-- object a later migration drops is not expected. Rows that say MISSING sort first. Expect none; a MISSING row names the migration to re-apply.
-- Names are matched exactly; if a migration was edited after it was applied, a mismatch here can be a rename rather than a failure.
-- ============================================================================
with expected(kind, name, on_table, migration) as (values
  ('table', 'assessment_integrity', '', 210),
  ('table', 'competency_assessment_items', '', 204),
  ('table', 'competency_assessment_responses', '', 204),
  ('table', 'competency_assessment_results', '', 204),
  ('table', 'competency_assessment_settings', '', 204),
  ('table', 'competency_assessments', '', 204),
  ('table', 'competency_definition_versions', '', 204),
  ('table', 'knowledge_checks', '', 207),
  ('policy', 'Read assessment integrity', 'assessment_integrity', 210),
  ('policy', 'Record own assessment integrity', 'assessment_integrity', 210),
  ('policy', 'Update own open assessment integrity', 'assessment_integrity', 210),
  ('policy', 'Members read assessment items', 'competency_assessment_items', 204),
  ('policy', 'Members write assessment items', 'competency_assessment_items', 204),
  ('policy', 'Create response rows', 'competency_assessment_responses', 204),
  ('policy', 'Employee writes own answers', 'competency_assessment_responses', 204),
  ('policy', 'Read own, managed and company responses', 'competency_assessment_responses', 204),
  ('policy', 'Confirm, override or retry results', 'competency_assessment_results', 204),
  ('policy', 'Read own, managed and company results', 'competency_assessment_results', 204),
  ('policy', 'Write results', 'competency_assessment_results', 204),
  ('policy', 'Admins write assessment settings', 'competency_assessment_settings', 204),
  ('policy', 'Members read assessment settings', 'competency_assessment_settings', 204),
  ('policy', 'Assign or self-start assessments', 'competency_assessments', 204),
  ('policy', 'Read own, managed and company assessments', 'competency_assessments', 204),
  ('policy', 'Update own or managed assessments', 'competency_assessments', 204),
  ('policy', 'Withdraw unsubmitted assessments', 'competency_assessments', 204),
  ('policy', 'Members read definition versions', 'competency_definition_versions', 204),
  ('policy', 'Managers read their reports current roles', 'job_roles', 211),
  ('policy', 'Members read their own current role', 'job_roles', 205),
  ('policy', 'Answer own knowledge check', 'knowledge_checks', 207),
  ('policy', 'Assign knowledge checks', 'knowledge_checks', 209),
  ('policy', 'Read own, managed and company knowledge checks', 'knowledge_checks', 207),
  ('policy', 'Withdraw unsubmitted knowledge checks', 'knowledge_checks', 207),
  ('policy', 'Managers read their reports role requirements', 'role_competency_requirements', 211),
  ('policy', 'Members read their own role requirements', 'role_competency_requirements', 205),
  ('function', 'assessment_integrity_before_insert', '', 210),
  ('function', 'assessment_integrity_guard', '', 210),
  ('function', 'competency_assessment_self_start_allowed', '', 204),
  ('function', 'competency_definition_fingerprint', '', 204),
  ('function', 'competency_level_indicators_valid', '', 203),
  ('function', 'enforce_competency_assessment_integrity', '', 204),
  ('function', 'enforce_role_requirement_integrity', '', 203),
  ('function', 'is_my_current_role', '', 205),
  ('function', 'is_my_report_role', '', 211),
  ('function', 'knowledge_check_member_ok', '', 207),
  ('function', 'knowledge_checks_guard', '', 208),
  ('function', 'purge_expired_competency_assessment_answers', '', 204),
  ('function', 'record_competency_definition_version', '', 204),
  ('trigger', 'assessment_integrity_guard_trg', 'assessment_integrity', 210),
  ('trigger', 'assessment_integrity_insert_trg', 'assessment_integrity', 210),
  ('trigger', 'competency_responses_integrity', 'competency_assessment_responses', 204),
  ('trigger', 'competency_results_integrity', 'competency_assessment_results', 204),
  ('trigger', 'competency_assessments_integrity', 'competency_assessments', 204),
  ('trigger', 'knowledge_checks_guard_trg', 'knowledge_checks', 207),
  ('trigger', 'role_requirement_integrity', 'role_competency_requirements', 203)
),
found as (
  select 'table' as kind, tablename::text as name, ''::text as on_table from pg_tables where schemaname = 'public'
  union all select 'policy', policyname::text, tablename::text from pg_policies where schemaname = 'public'
  union all select 'function', proname::text, ''::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  union all select 'trigger', t.tgname::text, c.relname::text from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal
),
check_ as (
  select e.*, exists (select 1 from found f where f.kind = e.kind and f.name = e.name and f.on_table = e.on_table) as present
  from expected e
)
select migration, kind, name, on_table, case when present then 'present' else 'MISSING' end as status
from check_ order by present, migration, kind, name;
