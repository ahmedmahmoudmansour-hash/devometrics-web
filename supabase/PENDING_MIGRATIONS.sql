-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0129 THROUGH 0132
--
-- Everything through 0128 has been confirmed applied. 0129 adds a
-- single column (is_new_hire) to organization_invites, gating whether
-- the probation-review automation auto-starts on invite acceptance.
-- 0130 and 0131 each widen the email-type constraint for one new
-- customizable alert (low assessment score -> manager notification;
-- review acknowledgment comment -> manager + admin notification).
-- 0132 adds employee self-rating on competencies (self_rating/self_note
-- columns + a new employee-only RPC), alongside the existing
-- manager rating on the same row.
--
-- Ahmed is batching these — hold off running until he confirms he's
-- ready, rather than prompting after each one.
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

-- ============================================================
-- 0131_review_acknowledgment_alert_email.sql
-- ============================================================
-- 0131: One more customizable automation-fired alert email
--
-- An employee's acknowledgment comment (e.g. disagreement with a low
-- manager rating — a manager rating is never locked, so the practical path
-- today is "raise it, the manager revises") used to sit silently in the
-- database — visible only to someone who happened to open that specific
-- review. Now routes it to both the employee's manager and an org admin.
-- Same named-constraint widening pattern as 0107/0110/0115/0124/0126/0130
-- established specifically so this never needs to guess a
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
    'midyear_checkin_scheduled_alert', 'manager_assessment_reminder',
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert'
  ));

-- ============================================================
-- 0132_self_competency_ratings.sql
-- ============================================================
-- 0132: Employee self-rating on competencies
--
-- Per the CEO, reviewing a live test run: competency ratings were
-- manager/admin only — set_competency_rating's own auth check is
-- is_org_admin OR is_manager_of_user, so the employee couldn't rate their
-- own competencies even if the UI offered it. This adds a parallel
-- self_rating/self_note pair on the existing performance_review_
-- competency_ratings row — same "one row, both authors' values side by
-- side" shape already used for the overall self-rating vs. manager-rating
-- (performance_review_self_assessments.rating vs.
-- performance_review_manager_assessments.rating) — plus a new
-- employee-only RPC to set it.
--
-- rating (the manager's) must become nullable: a row can now legitimately
-- exist with only a self_rating and no manager rating yet, if the employee
-- rates before the manager does.

alter table public.performance_review_competency_ratings
  alter column rating drop not null;

alter table public.performance_review_competency_ratings
  add column if not exists self_rating integer check (self_rating between 1 and 5),
  add column if not exists self_note text,
  add column if not exists self_submitted_at timestamptz;

-- Mirrors set_competency_rating's own shape exactly, just employee-scoped
-- (v_employee != auth.uid() rejects everyone else, including the manager
-- and org admins — this is specifically the employee's own judgment) and
-- writing to the self_* columns instead.
create or replace function public.set_self_competency_rating(
  target_review_id uuid,
  p_dimension text,
  p_rating integer,
  p_note text,
  p_organization_competency_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_mapped_dimension text;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or v_employee is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if p_organization_competency_id is not null then
    select mapped_dimension into v_mapped_dimension
    from public.organization_competencies
    where id = p_organization_competency_id and organization_id = v_org_id;
    if not found then
      raise exception 'Invalid competency';
    end if;

    insert into public.performance_review_competency_ratings (review_id, organization_competency_id, dimension, self_rating, self_note, self_submitted_at)
    values (target_review_id, p_organization_competency_id, v_mapped_dimension, p_rating, p_note, now())
    on conflict (review_id, organization_competency_id) where organization_competency_id is not null
    do update set self_rating = excluded.self_rating, self_note = excluded.self_note, self_submitted_at = now(), dimension = excluded.dimension;
  else
    insert into public.performance_review_competency_ratings (review_id, dimension, self_rating, self_note, self_submitted_at)
    values (target_review_id, p_dimension, p_rating, p_note, now())
    on conflict (review_id, dimension) where organization_competency_id is null
    do update set self_rating = excluded.self_rating, self_note = excluded.self_note, self_submitted_at = now();
  end if;
end;
$$;

revoke all on function public.set_self_competency_rating(uuid, text, integer, text, uuid) from public;
grant execute on function public.set_self_competency_rating(uuid, text, integer, text, uuid) to authenticated;
