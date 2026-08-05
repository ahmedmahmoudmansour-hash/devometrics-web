-- 0110: Optional deadline on assigned_assessments + a new
-- assessment_assignment email type
--
-- Migration 0101 deliberately gave assigned_assessments no due-date
-- concept ("open-ended assignment, not a deadline") — reversed here since
-- the product need has changed: an admin can now optionally set a
-- deadline when assigning an assessment, which shows up in the assignment
-- email and on the employee's calendar. Nullable — assigning without a
-- date keeps today's open-ended behavior exactly as-is.

alter table public.assigned_assessments
  add column if not exists due_date date;

-- Widen organization_email_messages.email_type to allow the new
-- assessment_assignment type — the immediate "you've been assigned this
-- assessment" notice, same treatment milestone_assignment already got in
-- 0107. That migration replaced the original inline/unnamed check
-- constraint with an explicitly named one specifically so this kind of
-- follow-up widening never has to guess a Postgres-generated name again.
alter table public.organization_email_messages
  drop constraint if exists organization_email_messages_email_type_check;
alter table public.organization_email_messages
  add constraint organization_email_messages_email_type_check
  check (email_type in (
    'task_reminder', 'certification_reminder', 'knowledge_hub_reminder',
    'performance_review_reminder', 'assessment_reminder',
    'knowledge_hub_assignment', 'employee_invite',
    'hire_to_onboarding_manager_alert', 'high_potential_manager_alert',
    'onboarding_step_reminder', 'onboarding_manager_approval_reminder',
    'milestone_assignment', 'interview_stage_notice',
    'assessment_assignment'
  ));
