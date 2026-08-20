-- 0139: Notify candidates on offer/rejected, not just interview
--
-- Hiring/training process-gap audit (2026-08-20): moveCandidateStage only
-- ever emailed a candidate on the "interview" stage. Moving someone to
-- "offer" or "rejected" sent nothing — a rejected candidate has no
-- dashboard login to check status themselves, so they'd simply never find
-- out. Two more customizable email types, same named-constraint widening
-- pattern established since 0107.

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
    'department_head_review_reminder', 'review_escalation_requested_alert',
    'review_escalation_resolved_alert', 'offer_stage_notice',
    'rejected_stage_notice'
  ));
