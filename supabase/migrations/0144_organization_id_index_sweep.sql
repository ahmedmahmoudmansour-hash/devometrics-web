-- 0144: Add missing organization_id indexes across the platform
--
-- Full-platform audit (2026-08-25): cross-checked every table's foreign-key
-- columns against every CREATE INDEX / UNIQUE constraint ever written in
-- migration history. These 17 tables have an organization_id column that
-- is filtered on directly by their own RLS policies (confirmed on
-- employee_performance_rating_history and onboarding_instances, both of
-- which gate admin reads with `using (public.is_org_admin(organization_id))`
-- or an equivalent direct filter) and/or by application queries scoping a
-- list to the caller's company -- but have never had an index covering
-- that column, in any position, in any migration. Every read against these
-- tables has been a sequential scan since the table was created; this
-- matches the precedent already set in 0142 for performance_reviews.
-- Purely additive -- CREATE INDEX IF NOT EXISTS, no schema/data change.
create index if not exists idx_employee_manager_notes_organization_id
  on public.employee_manager_notes (organization_id);

create index if not exists idx_employee_performance_rating_history_organization_id
  on public.employee_performance_rating_history (organization_id);

create index if not exists idx_employee_role_change_history_organization_id
  on public.employee_role_change_history (organization_id);

create index if not exists idx_hiring_candidate_assessments_organization_id
  on public.hiring_candidate_assessments (organization_id);

create index if not exists idx_hiring_candidate_cv_scores_organization_id
  on public.hiring_candidate_cv_scores (organization_id);

create index if not exists idx_hiring_candidate_interview_notes_organization_id
  on public.hiring_candidate_interview_notes (organization_id);

create index if not exists idx_hiring_candidate_stage_history_organization_id
  on public.hiring_candidate_stage_history (organization_id);

create index if not exists idx_job_posting_competency_requirements_organization_id
  on public.job_posting_competency_requirements (organization_id);

create index if not exists idx_knowledge_hub_content_versions_organization_id
  on public.knowledge_hub_content_versions (organization_id);

create index if not exists idx_onboarding_instances_organization_id
  on public.onboarding_instances (organization_id);

create index if not exists idx_onboarding_templates_organization_id
  on public.onboarding_templates (organization_id);

create index if not exists idx_organization_email_messages_organization_id
  on public.organization_email_messages (organization_id);

create index if not exists idx_performance_review_workflow_templates_organization_id
  on public.performance_review_workflow_templates (organization_id);

create index if not exists idx_role_competency_requirements_organization_id
  on public.role_competency_requirements (organization_id);

create index if not exists idx_role_transitions_organization_id
  on public.role_transitions (organization_id);

create index if not exists idx_surveys_organization_id
  on public.surveys (organization_id);

create index if not exists idx_workflow_automation_settings_organization_id
  on public.workflow_automation_settings (organization_id);
