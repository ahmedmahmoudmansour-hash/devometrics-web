-- 0140: Stale-candidate / dead-posting visibility for Hiring
--
-- Hiring/training process-gap audit (2026-08-20): HiringPipelineBoard
-- already computes a 14-day staleness badge per candidate, but it's only
-- ever visible on that one posting's own board — an admin has to open
-- every open posting to notice a candidate stuck 3+ weeks in "interview,"
-- or a posting that's been open for months with zero candidates. Hiring
-- also had zero entry in the daily reminders cron, unlike every other
-- domain audited this session. Adds (a) a live admin-gated summary RPC
-- for a dashboard widget (same posture as get_overdue_assignments/
-- get_escalated_reviews) and (b) a weekly digest email to org admins,
-- with its own dedup table since this is an org-wide digest, not a
-- per-item reminder.

create table if not exists public.hiring_attention_reminder_log (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_sent_at timestamptz not null default now()
);

alter table public.hiring_attention_reminder_log enable row level security;

create or replace function public.get_hiring_attention_summary(target_organization_id uuid)
returns table(
  category text,
  candidate_id uuid,
  candidate_name text,
  posting_id uuid,
  posting_title text,
  days integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(target_organization_id) then
    raise exception 'Not authorized';
  end if;

  return query
    select 'stale_candidate'::text, c.id, c.full_name, c.posting_id, p.title,
           floor(extract(epoch from (now() - c.updated_at)) / 86400)::integer
    from public.hiring_candidates c
    join public.job_postings p on p.id = c.posting_id
    where c.organization_id = target_organization_id
      and c.stage in ('applied', 'phone_screen', 'interview', 'offer')
      and c.updated_at < now() - interval '14 days'

    union all

    select 'dead_posting'::text, null, null, p.id, p.title,
           floor(extract(epoch from (now() - p.created_at)) / 86400)::integer
    from public.job_postings p
    where p.organization_id = target_organization_id
      and p.status = 'open'
      and p.created_at < now() - interval '30 days'
      and not exists (select 1 from public.hiring_candidates c2 where c2.posting_id = p.id)

    order by days desc
    limit 50;
end;
$$;

revoke all on function public.get_hiring_attention_summary(uuid) from public;
grant execute on function public.get_hiring_attention_summary(uuid) to authenticated;

-- One row per (org, admin) needing a digest — every org admin gets it, not
-- just one (an operational "things need attention" digest, unlike the
-- single-recipient-fallback pattern used for individual review
-- notifications). Weekly cadence via hiring_attention_reminder_log, one
-- row per org.
create or replace function public.due_hiring_attention_digest(secret text)
returns table(
  organization_id uuid,
  recipient_user_id uuid,
  email text,
  full_name text,
  stale_candidate_count integer,
  dead_posting_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  with org_counts as (
    select
      o.id as organization_id,
      (
        select count(*) from public.hiring_candidates c
        where c.organization_id = o.id
          and c.stage in ('applied', 'phone_screen', 'interview', 'offer')
          and c.updated_at < now() - interval '14 days'
      ) as stale_candidate_count,
      (
        select count(*) from public.job_postings p
        where p.organization_id = o.id
          and p.status = 'open'
          and p.created_at < now() - interval '30 days'
          and not exists (select 1 from public.hiring_candidates c2 where c2.posting_id = p.id)
      ) as dead_posting_count
    from public.organizations o
  )
  select oc.organization_id, om.user_id, pr.email, pr.full_name, oc.stale_candidate_count, oc.dead_posting_count
  from org_counts oc
  join public.organization_members om on om.organization_id = oc.organization_id and om.role = 'admin'
  join public.profiles pr on pr.id = om.user_id
  left join public.hiring_attention_reminder_log l on l.organization_id = oc.organization_id
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and (oc.stale_candidate_count > 0 or oc.dead_posting_count > 0)
    and pr.email is not null
    and (l.last_sent_at is null or l.last_sent_at < now() - interval '7 days')
  order by oc.organization_id;
$$;

revoke all on function public.due_hiring_attention_digest(text) from public;
grant execute on function public.due_hiring_attention_digest(text) to anon, authenticated;

create or replace function public.mark_hiring_attention_digest_sent(secret text, target_organization_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.hiring_attention_reminder_log (organization_id, last_sent_at)
  select target_organization_id, now()
  where secret = (select value from public.app_secrets where key = 'cron_secret')
  on conflict (organization_id) do update set last_sent_at = now();
$$;

revoke all on function public.mark_hiring_attention_digest_sent(text, uuid) from public;
grant execute on function public.mark_hiring_attention_digest_sent(text, uuid) to anon, authenticated;

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
    'rejected_stage_notice', 'hiring_attention_digest'
  ));
