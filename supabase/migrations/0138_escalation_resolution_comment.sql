-- 0138: Require a resolution comment on "Mark resolved"
--
-- Escalating requires a comment ("why you disagree"), but resolving was a
-- bare click — no record of HOW the concern was actually addressed. Per
-- the CEO: give HR a comment field there too, for symmetry and a real
-- audit trail (escalated because X, resolved because Y). The employee is
-- notified with this comment when their escalation is resolved, but
-- doesn't have to sign off on it — informational, not a second
-- acknowledge_review loop (per the CEO's own "no need" on that point).

alter table public.performance_reviews
  add column if not exists escalation_resolution_comment text;

-- Signature changed (uuid) -> (uuid, text) — Postgres treats a different
-- parameter list as a distinct overload, not a replacement, so the old
-- single-arg version must be dropped explicitly or it'd linger unused.
drop function if exists public.resolve_review_escalation(uuid);

create or replace function public.resolve_review_escalation(target_review_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;
  if coalesce(trim(p_comment), '') = '' then
    raise exception 'A comment is required to resolve an escalation';
  end if;

  update public.performance_reviews
    set escalation_resolved_at = now(), escalation_resolved_by = auth.uid(), escalation_resolution_comment = p_comment
    where id = target_review_id;
end;
$$;

revoke all on function public.resolve_review_escalation(uuid, text) from public;
grant execute on function public.resolve_review_escalation(uuid, text) to authenticated;

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
    'review_escalation_resolved_alert'
  ));
