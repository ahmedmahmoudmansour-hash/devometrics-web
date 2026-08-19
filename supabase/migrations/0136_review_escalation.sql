-- 0136: Employee-initiated review escalation
--
-- The acknowledgment-comment alert (0131) notifies someone when an employee
-- writes something — but it's passive: there's no explicit "I disagree,
-- please have this reviewed further" action, no persistent visible status,
-- and no clear target. This adds a real escalation: an employee-only RPC
-- that stamps the review and notifies whoever's actually positioned to act
-- — an eligible upline manager (level 2+, same chain-walk 0135 already
-- computes) if one exists, an org admin either way.
--
-- Deliberately non-blocking (per the CEO): escalating doesn't gate
-- close_review or anything else — same "informational, RLS is the real
-- boundary" posture as the timeline work and everything else in this
-- schema. It's visibility, not a hard stop.

alter table public.performance_reviews
  add column if not exists escalation_requested_at timestamptz,
  add column if not exists escalation_comment text;

create or replace function public.request_review_escalation(target_review_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
begin
  select employee_user_id into v_employee from public.performance_reviews where id = target_review_id;
  if v_employee is null or v_employee is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  if coalesce(trim(p_comment), '') = '' then
    raise exception 'A comment is required to escalate';
  end if;

  update public.performance_reviews
    set escalation_requested_at = now(), escalation_comment = p_comment
    where id = target_review_id;
end;
$$;

revoke all on function public.request_review_escalation(uuid, text) from public;
grant execute on function public.request_review_escalation(uuid, text) to authenticated;

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
    'department_head_review_reminder', 'review_escalation_requested_alert'
  ));
