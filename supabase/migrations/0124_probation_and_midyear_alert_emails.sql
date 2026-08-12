-- 0124: Two more customizable automation-fired alert emails
--
-- UX audit follow-up on the 2026-08-11 5-part program: neither the
-- hire_to_probation nor the low_manager_rating_to_midyear automation
-- (both shipped without an audit pass) actually told anyone anything —
-- a probation review sat silently on My Team until a manager happened to
-- visit, and a mid-year check-in appeared for an employee with zero
-- explanation. Adds two more manager/employee alert emails, same
-- customizable-via-org-settings pattern as hire_to_onboarding_manager_alert
-- and high_potential_manager_alert. Same named-constraint widening pattern
-- 0107/0110/0115 established specifically so this never needs to guess a
-- Postgres-generated constraint name.

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
    'milestone_assignment', 'interview_stage_notice', 'assessment_assignment',
    'knowledge_hub_content_updated', 'probation_review_ready_alert',
    'midyear_checkin_scheduled_alert'
  ));
