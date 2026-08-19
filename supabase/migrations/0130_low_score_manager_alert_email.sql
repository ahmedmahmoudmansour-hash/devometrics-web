-- 0130: One more customizable automation-fired alert email
--
-- low_score_to_reassessment used to fire completely privately — only the
-- employee's own two follow-up tasks, nobody else ever notified. An
-- asymmetry with high_potential_to_succession, which already emails the
-- manager on a GOOD score. Per the CEO: add the same manager visibility
-- for a low score. Same named-constraint widening pattern as
-- 0107/0110/0115/0124/0126/0130 established specifically so this never
-- needs to guess a Postgres-generated constraint name.

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
    'midyear_checkin_scheduled_alert', 'manager_assessment_reminder',
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert'
  ));
