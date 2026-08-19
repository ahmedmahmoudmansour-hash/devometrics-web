-- 0134: Two more customizable automation-fired alert emails
--
-- review_reopened_alert: submit_manager_assessment has no status guard, so
-- resubmitting a rating on a closed review silently reopens it — now
-- notifies the employee and an org admin.
-- department_head_review_reminder: the optional Department Head Review was
-- the one manager-facing step left with no recurring reminder (0126 added
-- the manager-assessment and probation-acceptance reminders, but not this
-- one) — an eligible upline manager who never signs off was never nudged.
-- The actual reminder RPCs for the second one are in 0135; this migration
-- just widens the constraint for both so 0135 doesn't need to touch it
-- again. Same named-constraint widening pattern as
-- 0107/0110/0115/0124/0126/0130/0131 established specifically so this
-- never needs to guess a Postgres-generated constraint name.

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert', 'review_reopened_alert',
    'department_head_review_reminder'
  ));
