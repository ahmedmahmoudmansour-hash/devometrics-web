// Plain (non-"use server") module — a "use server" file may only export
// async functions, so this constant/type data lives here instead of
// alongside updateOrganizationEmailMessage in emailMessages.ts. Keep in
// sync with the check constraint on organization_email_messages
// (migration 0101) and every due_*_reminders SQL function's email_type
// join condition.
export const EMAIL_MESSAGE_TYPES = [
  "task_reminder",
  "certification_reminder",
  "knowledge_hub_reminder",
  "performance_review_reminder",
  "assessment_reminder",
  "knowledge_hub_assignment",
  "employee_invite",
  "hire_to_onboarding_manager_alert",
  "high_potential_manager_alert",
  "onboarding_step_reminder",
  "onboarding_manager_approval_reminder",
  "milestone_assignment",
  "interview_stage_notice",
] as const;
export type EmailMessageType = (typeof EMAIL_MESSAGE_TYPES)[number];

export type EmailMessageOverride = { subject: string; message: string };
