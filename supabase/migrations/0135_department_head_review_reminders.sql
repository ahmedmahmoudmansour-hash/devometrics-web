-- 0135: Department Head Review reminders
--
-- Migration 0126 added recurring reminders for the manager_assessment step
-- and probation acceptance — but the optional Department Head Review
-- (level 2+ upline signoff, submit_upline_signoff) was left out. It's the
-- one manager-facing step in this app with no reminder at all: an eligible
-- upline manager who never signs off is simply never nudged.
--
-- performance_review_upline_signoffs only ever gets a row once someone
-- actually submits (see submit_upline_signoff) — there's no pre-seeded
-- "pending" row to attach a last_reminder_sent_at column to, and eligible
-- levels are computed dynamically from the org's review_escalation_levels
-- setting by walking organization_members.manager_user_id, not stored
-- anywhere. So this needs its own small dedup table (below) plus a
-- recursive CTE to walk the chain, rather than reusing
-- performance_reviews.last_manager_reminder_sent_at (0126) — that column
-- is already shared by the manager-assessment/probation-acceptance
-- reminders, and reusing it here would let this reminder suppress those or
-- vice versa, which are genuinely different recipients for different
-- steps.

-- RLS enabled with ZERO policies — deliberately unreachable via the API
-- (SELECT included) for every role including authenticated. Pure
-- cron-bookkeeping: only the SECURITY DEFINER functions below ever touch
-- it, the same posture as any other internal-only table in this schema.
create table if not exists public.performance_review_upline_reminder_log (
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  manager_user_id uuid not null,
  last_reminder_sent_at timestamptz not null default now(),
  primary key (review_id, manager_user_id)
);

alter table public.performance_review_upline_reminder_log enable row level security;

create or replace function public.due_department_head_review_reminders(secret text)
returns table(
  review_id uuid,
  recipient_user_id uuid,
  email text,
  full_name text,
  employee_name text,
  cycle_name text,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
stable
as $$
  with recursive chain as (
    -- Level 1 = the employee's direct manager, walked the same way
    -- getUplineChain (lib/performanceReviews/actions.ts) does it — level 1
    -- is excluded below since that's the ordinary manager_assessment step,
    -- already covered by 0126.
    select
      r.id as review_id,
      r.organization_id,
      r.employee_user_id,
      1 as level,
      om.manager_user_id,
      least(coalesce(o.review_escalation_levels, 1), 10) as max_level
    from public.performance_reviews r
    join public.performance_review_cycles cyc on cyc.id = r.cycle_id
    join public.organization_members om on om.user_id = r.employee_user_id and om.organization_id = r.organization_id
    join public.organizations o on o.id = r.organization_id
    where cyc.status = 'open' and om.manager_user_id is not null

    union all

    select
      c.review_id,
      c.organization_id,
      c.employee_user_id,
      c.level + 1,
      om2.manager_user_id,
      c.max_level
    from chain c
    join public.organization_members om2 on om2.user_id = c.manager_user_id and om2.organization_id = c.organization_id
    where c.level < c.max_level and om2.manager_user_id is not null
  )
  select
    c.review_id,
    c.manager_user_id,
    p.email,
    p.full_name,
    emp.full_name,
    cyc.name,
    oem.custom_subject,
    oem.custom_message
  from chain c
  join public.performance_reviews r on r.id = c.review_id
  join public.performance_review_cycles cyc on cyc.id = r.cycle_id
  join public.profiles p on p.id = c.manager_user_id
  join public.profiles emp on emp.id = c.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = c.organization_id and oem.email_type = 'department_head_review_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and c.level >= 2
    and p.email is not null
    and not exists (
      select 1 from public.performance_review_upline_signoffs s
      where s.review_id = c.review_id and s.manager_user_id = c.manager_user_id and s.signed_off_at is not null
    )
    and not exists (
      select 1 from public.performance_review_upline_reminder_log l
      where l.review_id = c.review_id and l.manager_user_id = c.manager_user_id
        and l.last_reminder_sent_at > now() - interval '7 days'
    );
$$;

revoke all on function public.due_department_head_review_reminders(text) from public;
grant execute on function public.due_department_head_review_reminders(text) to anon, authenticated;

create or replace function public.mark_department_head_review_reminder_sent(secret text, target_review_id uuid, target_manager_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.performance_review_upline_reminder_log (review_id, manager_user_id, last_reminder_sent_at)
  select target_review_id, target_manager_user_id, now()
  where secret = (select value from public.app_secrets where key = 'cron_secret')
  on conflict (review_id, manager_user_id) do update set last_reminder_sent_at = now();
$$;

revoke all on function public.mark_department_head_review_reminder_sent(text, uuid, uuid) from public;
grant execute on function public.mark_department_head_review_reminder_sent(text, uuid, uuid) to anon, authenticated;
