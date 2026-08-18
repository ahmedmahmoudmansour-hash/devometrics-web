-- 0126: Manager-action reminders (process-delay audit follow-up, 2026-08-18)
--
-- A process-delay audit found that close_review blocks a cycle from
-- closing until the manager_assessment step is submitted, and
-- getMyCurrentReview hides any probation review until the hiring manager
-- calls accept_probation_review — but nothing ever reminded the MANAGER
-- about either. Only the employee's self-assessment had a reminder
-- (due_performance_review_reminders, migration 0101). A review can
-- therefore stall silently for weeks with no one nudged and no admin
-- visibility. This migration adds one reminder function covering both
-- stall points (they're mutually exclusive per review, so one function
-- with a `kind` discriminator avoids near-duplicate SQL), with an
-- admin-fallback recipient for the case where the employee's manager_user_id
-- is unset (e.g. the manager left) — otherwise that case had NO possible
-- recipient at all.
--
-- Also fixes an adjacent bug this audit surfaced in due_performance_review_
-- reminders itself: it reminds the EMPLOYEE about an unstarted self-
-- assessment based only on cyc.status = 'open' and r.status = 'not_started'
-- — it never checked whether the review is still gated behind hiring-
-- manager acceptance (getMyCurrentReview would hide it from them entirely,
-- so the email would point at something they can't open) or whether the
-- review's own step list even HAS a self_assessment step (probation
-- reviews never do — submit_manager_assessment is the only step-0 action,
-- so r.status stays 'not_started' indefinitely regardless, and the old
-- query would eventually email the new hire to "start your self-
-- reflection" for a workflow that has none).

alter table public.performance_reviews
  add column if not exists last_manager_reminder_sent_at timestamptz;

-- Same named-constraint widen pattern as 0107/0110/0115/0124 — this
-- constraint has had an explicit, stable name since 0101, so no need to
-- look it up via information_schema.
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
    'probation_acceptance_reminder'
  ));

create or replace function public.due_manager_action_reminders(secret text)
returns table(
  review_id uuid,
  recipient_user_id uuid,
  email text,
  full_name text,
  employee_name text,
  cycle_name text,
  kind text,
  is_fallback_admin boolean,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
stable
as $$
  with candidates as (
    select
      r.id as review_id,
      r.organization_id,
      cyc.name as cycle_name,
      emp_p.full_name as employee_name,
      om.manager_user_id,
      coalesce(
        om.manager_user_id,
        (select om2.user_id from public.organization_members om2
         where om2.organization_id = r.organization_id and om2.role = 'admin' limit 1)
      ) as recipient_user_id,
      case
        when r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null
          then 'accept_probation'
        else 'submit_assessment'
      end as kind
    from public.performance_reviews r
    join public.performance_review_cycles cyc on cyc.id = r.cycle_id
    join public.organization_members om on om.user_id = r.employee_user_id
    join public.profiles emp_p on emp_p.id = r.employee_user_id
    where secret = (select value from public.app_secrets where key = 'cron_secret')
      and cyc.status = 'open'
      and (r.last_manager_reminder_sent_at is null or r.last_manager_reminder_sent_at < now() - interval '7 days')
      and (
        (r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null)
        or (
          not (r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null)
          and exists (
            select 1 from public.performance_review_instance_steps s
            where s.review_id = r.id and s.step_type = 'manager_assessment'
          )
          and not exists (
            select 1 from public.performance_review_manager_assessments ma
            where ma.review_id = r.id and ma.submitted_at is not null
          )
        )
      )
  )
  select c.review_id, c.recipient_user_id, p.email, p.full_name, c.employee_name, c.cycle_name,
         c.kind, (c.manager_user_id is null) as is_fallback_admin,
         oem.custom_subject, oem.custom_message
  from candidates c
  join public.profiles p on p.id = c.recipient_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = c.organization_id
   and oem.email_type = (case c.kind when 'accept_probation' then 'probation_acceptance_reminder' else 'manager_assessment_reminder' end)
  where p.email is not null;
$$;

revoke all on function public.due_manager_action_reminders(text) from public;
grant execute on function public.due_manager_action_reminders(text) to anon, authenticated;

create or replace function public.mark_manager_action_reminder_sent(secret text, target_review_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.performance_reviews set last_manager_reminder_sent_at = now()
  where id = target_review_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_manager_action_reminder_sent(text, uuid) from public;
grant execute on function public.mark_manager_action_reminder_sent(text, uuid) to anon, authenticated;

-- Bugfix (see header): exclude acceptance-gated reviews the employee can't
-- even see yet, and only fire for reviews whose own step list actually
-- includes self_assessment (or has zero instance steps at all — same safe
-- fallback close_review already uses for manager_assessment).
create or replace function public.due_performance_review_reminders(secret text)
returns table(
  review_id uuid,
  employee_user_id uuid,
  email text,
  full_name text,
  cycle_name text,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.employee_user_id, p.email, p.full_name, cyc.name,
    oem.custom_subject, oem.custom_message
  from public.performance_reviews r
  join public.performance_review_cycles cyc on cyc.id = r.cycle_id
  join public.profiles p on p.id = r.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = r.organization_id and oem.email_type = 'performance_review_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and cyc.status = 'open'
    and r.status = 'not_started'
    and p.email is not null
    and not (r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null)
    and (
      not exists (select 1 from public.performance_review_instance_steps s where s.review_id = r.id)
      or exists (
        select 1 from public.performance_review_instance_steps s
        where s.review_id = r.id and s.step_type = 'self_assessment'
      )
    )
    and (r.last_reminder_sent_at is null or r.last_reminder_sent_at < now() - interval '7 days');
$$;

revoke all on function public.due_performance_review_reminders(text) from public;
grant execute on function public.due_performance_review_reminders(text) to anon, authenticated;
