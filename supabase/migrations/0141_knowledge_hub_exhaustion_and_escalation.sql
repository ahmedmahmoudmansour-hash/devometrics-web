-- 0141: Knowledge Hub — exhausted-attempts alert email + manager escalation
--
-- Hiring/training process-gap audit (2026-08-20), two Knowledge Hub gaps:
--
-- 1. submit_knowledge_hub_exam (0087) tells the employee to "contact your
--    admin" once they've used every attempt, but there was no actual way
--    to do that in-app and no admin was ever told either — someone could
--    permanently fail out of required/compliance training silently. Just
--    widens the email-type constraint here; the notification logic itself
--    lives in the TS action (submitKnowledgeHubExam), not a new RPC.
--
-- 2. due_knowledge_hub_reminders (0085/0101/0127) re-nudges only the
--    assignee, forever, on a 3-day cadence — never escalating to their
--    manager even after a severely overdue assignment (30+ days), unlike
--    the manager/department-head escalation paths already built for
--    performance reviews. Adds manager_notified_at (separate dedup from
--    last_reminder_sent_at, since this only needs to fire once, not every
--    3 days) plus manager email/name and an escalate flag in the query.

alter table public.knowledge_hub_assignments
  add column if not exists manager_notified_at timestamptz;

create or replace function public.due_knowledge_hub_reminders(secret text)
returns table(
  assignment_id uuid,
  user_id uuid,
  email text,
  full_name text,
  content_title text,
  due_date date,
  overdue boolean,
  custom_subject text,
  custom_message text,
  escalate_to_manager boolean,
  manager_user_id uuid,
  manager_email text,
  manager_full_name text
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      a.id, a.employee_user_id, a.manager_notified_at, u.email, p.full_name, c.title, c.due_date,
      coalesce(c.due_date < current_date, false) as overdue,
      org.organization_id,
      (
        (c.due_date is not null and c.due_date <= current_date - interval '30 days')
        or (c.due_date is null and c.is_new_hire_content and a.created_at <= now() - interval '30 days')
      ) as is_severely_overdue
    from public.knowledge_hub_assignments a
    join public.knowledge_hub_content c on c.id = a.content_id and c.archived_at is null
    join auth.users u on u.id = a.employee_user_id
    left join public.profiles p on p.id = u.id
    left join lateral (
      select om.organization_id from public.organization_members om where om.user_id = u.id limit 1
    ) org on true
    where secret = (select value from public.app_secrets where key = 'cron_secret')
      and u.email is not null
      and (
        (c.due_date is not null and c.due_date <= current_date + interval '7 days')
        or (c.due_date is null and c.is_new_hire_content and a.created_at <= now() - interval '7 days')
      )
      and not exists (
        select 1 from public.knowledge_hub_completions comp
        where comp.content_id = a.content_id and comp.employee_user_id = a.employee_user_id
      )
      and (a.last_reminder_sent_at is null or a.last_reminder_sent_at < now() - interval '3 days')
  )
  select
    b.id, b.employee_user_id, b.email, b.full_name, b.title, b.due_date, b.overdue,
    oem.custom_subject, oem.custom_message,
    (b.is_severely_overdue and b.manager_notified_at is null) as escalate_to_manager,
    om.manager_user_id, mp.email, mp.full_name
  from base b
  left join public.organization_email_messages oem
    on oem.organization_id = b.organization_id and oem.email_type = 'knowledge_hub_reminder'
  left join public.organization_members om on om.user_id = b.employee_user_id
  left join public.profiles mp on mp.id = om.manager_user_id;
$$;

revoke all on function public.due_knowledge_hub_reminders(text) from public;
grant execute on function public.due_knowledge_hub_reminders(text) to anon, authenticated;

create or replace function public.mark_knowledge_hub_manager_notified(secret text, target_assignment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.knowledge_hub_assignments set manager_notified_at = now()
  where id = target_assignment_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_knowledge_hub_manager_notified(text, uuid) from public;
grant execute on function public.mark_knowledge_hub_manager_notified(text, uuid) to anon, authenticated;

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
    'rejected_stage_notice', 'hiring_attention_digest',
    'knowledge_hub_attempts_exhausted_alert'
  ));
