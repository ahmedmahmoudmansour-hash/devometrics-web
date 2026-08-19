// Plain (non-"use server") module — a "use server" file may only export
// async functions, so this constant/type data lives here instead of
// alongside updateOrganizationEmailMessage in emailMessages.ts. Keep in
// sync with the check constraint on organization_email_messages
// (migration 0101) and every due_*_reminders SQL function's email_type
// join condition.
// certification_reminder deliberately removed — the reminder email itself
// is retired (per Ahmed), but the Certifications page/tracking and any
// existing employee data are untouched. Its SECURITY DEFINER SQL
// functions (0101) and the check constraint value are left in place in
// the database rather than migrated out; this array is what actually
// controls whether the type appears anywhere in the app.
// onboarding_step_reminder / onboarding_manager_approval_reminder (0107)
// removed the same way when the standalone Onboarding feature was retired
// (migration 0120) — hire_to_onboarding_manager_alert is KEPT: that's the
// unrelated "new hire joined, here's your manager notification" email,
// still sent by runHireWelcome (lib/automations/recipes.ts).
// probation_review_ready_alert / midyear_checkin_scheduled_alert (0124) —
// added on a UX audit pass after the 5-part program shipped without any
// notification for either automation firing at all.
// manager_assessment_reminder / probation_acceptance_reminder (0126) —
// added on a process-delay audit pass: neither the manager_assessment step
// nor the probation hiring-manager-acceptance gate had ANY recurring
// reminder before this, so either could stall a review indefinitely.
// low_assessment_score_manager_alert (0130) — low_score_to_reassessment
// used to fire completely privately (only the employee's own tasks), an
// asymmetry with high_potential_to_succession which already notifies the
// manager on a good score. Now mirrors that pattern for a low one too.
// review_acknowledgment_comment_alert (0131) — an employee's acknowledgment
// comment (e.g. disagreement with a low rating) used to sit silently in the
// database, visible only to someone who happened to open that specific
// review. Now routes to the manager and an org admin.
// review_reopened_alert (0134) — submit_manager_assessment has no status
// guard, so resubmitting a rating on a closed review silently reopens it.
// Now notifies the employee and an org admin when that happens.
// department_head_review_reminder (0135) — the optional Department Head
// Review was the one manager-facing step left with no recurring reminder;
// an eligible upline manager who never signs off was never nudged.
export const EMAIL_MESSAGE_TYPES = [
  "task_reminder",
  "knowledge_hub_reminder",
  "performance_review_reminder",
  "assessment_reminder",
  "knowledge_hub_assignment",
  "employee_invite",
  "hire_to_onboarding_manager_alert",
  "high_potential_manager_alert",
  "milestone_assignment",
  "interview_stage_notice",
  "assessment_assignment",
  "knowledge_hub_content_updated",
  "probation_review_ready_alert",
  "midyear_checkin_scheduled_alert",
  "manager_assessment_reminder",
  "probation_acceptance_reminder",
  "low_assessment_score_manager_alert",
  "review_acknowledgment_comment_alert",
  "review_reopened_alert",
  "department_head_review_reminder",
] as const;
export type EmailMessageType = (typeof EMAIL_MESSAGE_TYPES)[number];

export type EmailMessageOverride = { subject: string; message: string };
