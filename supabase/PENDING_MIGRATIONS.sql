-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0129 THROUGH 0130
--
-- Everything through 0128 has been confirmed applied. 0129 adds a
-- single column (is_new_hire) to organization_invites, gating whether
-- the probation-review automation auto-starts on invite acceptance.
-- 0130 widens the email-type constraint for one new customizable
-- alert (low assessment score -> manager notification).
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run. If anything errors partway, copy the exact
-- error text back so it can be diagnosed rather than re-run blind.
-- ============================================================

-- ============================================================
-- 0129_invite_new_hire_flag.sql
-- ============================================================
-- 0129: Explicit is_new_hire flag on organization_invites
--
-- Both hire_to_onboarding (Knowledge Hub welcome content) and
-- hire_to_probation used to fire for EVERY invite-based join — someone
-- directly added on the Employees page got treated identically to someone
-- who actually came through the Hiring pipeline. Fine for the welcome
-- content (harmless either way), wrong for probation: an admin bulk-adding
-- existing staff to get them onto the platform would spin up a probation
-- review for every single one of them.
--
-- Per the CEO: keep welcome broad (unchanged), but probation should only
-- auto-start when there's a real signal this is a genuine new hire — either
-- (a) they came through the Hiring pipeline (candidate_id already implies
-- this), or (b) the admin explicitly marks them as one when inviting
-- directly. Default false everywhere so the safe/quiet behavior — no
-- probation review — is what happens unless someone opts in.

alter table public.organization_invites
  add column if not exists is_new_hire boolean not null default false;

-- ============================================================
-- 0130_low_score_manager_alert_email.sql
-- ============================================================
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
