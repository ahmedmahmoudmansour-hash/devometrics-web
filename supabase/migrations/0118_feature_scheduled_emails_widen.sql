-- 0118: Widen feature_scheduled_emails.feature_key to every company page
--
-- 0116 launched the ad-hoc "compose, pick recipients, send or schedule"
-- email tool on 4 pages (Knowledge Hub, Impact Cycles, Surveys,
-- Employees/Assessments). This extends the same tool to every remaining
-- company-facing feature page that has a real audience to communicate
-- with: Job Architecture, Hiring, Org Chart, Competencies, High
-- Potential, Succession, Scorecard, Exit Interviews, and Onboarding.
--
-- Deliberately NOT added: Profile (org-level settings, not a feature with
-- its own audience), Permissions (admin-only config, not something to
-- email people about), Analytics (a read-only dashboard, nothing to send).
--
-- Drops whatever the feature_key check constraint is ACTUALLY named,
-- looked up from information_schema rather than assumed — same pattern as
-- 0069's milestones.status widen.
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
    and tc.table_name = 'feature_scheduled_emails'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'feature_key'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.feature_scheduled_emails drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.feature_scheduled_emails
  add constraint feature_scheduled_emails_feature_key_check
  check (feature_key in (
    'knowledge_hub',
    'performance_review',
    'survey',
    'assessment',
    'job_architecture',
    'hiring',
    'org_chart',
    'competency_management',
    'high_potential',
    'succession',
    'scorecard',
    'exit_interviews',
    'onboarding'
  ));
