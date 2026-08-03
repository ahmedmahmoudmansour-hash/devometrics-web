-- 0101: Org-customizable email messages + performance review & assigned
-- assessment reminders
--
-- Two things bundled together because the second depends on the first:
--
-- 1. organization_email_messages — lets an org admin override the intro
--    message (and subject) of the reminder emails their own employees
--    receive. Deliberately narrow: the admin edits the human message text
--    only, never the surrounding shell (header/footer/button/branding),
--    which stays the fixed Devometrics standard — same "customize the
--    words, not the chrome" split as everywhere else this app lets an
--    admin influence AI/system output without full control.
--
-- 2. Two genuinely new reminder categories that had zero surfacing before
--    today: performance appraisals (an open Impact Cycle review still
--    'not_started') and assigned-but-incomplete assessments. Both follow
--    the exact SECURITY DEFINER + shared-secret pattern already
--    established in 0054/0074/0085 — this app has no service-role key, so
--    a cron request (no Supabase session at all) can't read across every
--    user's rows through normal RLS.

create table if not exists public.organization_email_messages (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_type text not null check (email_type in (
    'task_reminder', 'certification_reminder', 'knowledge_hub_reminder',
    'performance_review_reminder', 'assessment_reminder'
  )),
  custom_subject text,
  custom_message text,
  updated_at timestamptz not null default now(),
  primary key (organization_id, email_type)
);

alter table public.organization_email_messages enable row level security;

drop policy if exists "Org admins can view their email message overrides" on public.organization_email_messages;
create policy "Org admins can view their email message overrides"
  on public.organization_email_messages for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can set their email message overrides" on public.organization_email_messages;
create policy "Org admins can set their email message overrides"
  on public.organization_email_messages for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can update their email message overrides" on public.organization_email_messages;
create policy "Org admins can update their email message overrides"
  on public.organization_email_messages for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can remove their email message overrides" on public.organization_email_messages;
create policy "Org admins can remove their email message overrides"
  on public.organization_email_messages for delete
  using (public.is_org_admin(organization_id));

-- ============================================================
-- Retrofit the 3 existing reminder functions to also resolve the
-- recipient's org (if any, via a LATERAL + LIMIT 1 — mirrors this
-- codebase's established single-org-membership assumption, e.g.
-- getMyOrganizationMembership()'s .maybeSingle()) and return that org's
-- override text alongside the existing columns. A user with no org simply
-- gets null overrides, i.e. today's exact default copy — zero behavior
-- change until an admin actually sets one.
--
-- CREATE OR REPLACE cannot change a function's return columns, so these
-- are dropped and recreated rather than replaced in place.
-- ============================================================

drop function if exists public.due_task_reminders(text);
create function public.due_task_reminders(secret text)
returns table(user_id uuid, email text, full_name text, tasks jsonb, custom_subject text, custom_message text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name,
    jsonb_agg(
      jsonb_build_object('title', t.title, 'date', t.date, 'overdue', (t.recurring = 'none' and t.date < current_date))
      order by t.date
    ),
    oem.custom_subject, oem.custom_message
  from public.personal_tasks t
  join public.profiles p on p.id = t.user_id
  left join lateral (
    select om.organization_id from public.organization_members om where om.user_id = p.id limit 1
  ) org on true
  left join public.organization_email_messages oem
    on oem.organization_id = org.organization_id and oem.email_type = 'task_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and t.completed = false
    and p.email is not null
    and (t.date = current_date or (t.recurring = 'none' and t.date < current_date))
    and (p.last_task_reminder_sent_at is null or p.last_task_reminder_sent_at < current_date)
  group by p.id, p.email, p.full_name, oem.custom_subject, oem.custom_message;
$$;

revoke all on function public.due_task_reminders(text) from public;
grant execute on function public.due_task_reminders(text) to anon, authenticated;

drop function if exists public.due_certification_reminders(text);
create function public.due_certification_reminders(secret text)
returns table(user_id uuid, email text, full_name text, certifications jsonb, custom_subject text, custom_message text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name,
    jsonb_agg(
      jsonb_build_object(
        'name', c.credential_name,
        'issuer', c.issuer,
        'expiry_date', c.expiry_date,
        'expired', c.expiry_date < current_date
      )
      order by c.expiry_date
    ),
    oem.custom_subject, oem.custom_message
  from public.certifications c
  join public.profiles p on p.id = c.user_id
  left join lateral (
    select om.organization_id from public.organization_members om where om.user_id = p.id limit 1
  ) org on true
  left join public.organization_email_messages oem
    on oem.organization_id = org.organization_id and oem.email_type = 'certification_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and c.expiry_date is not null
    and c.expiry_date <= current_date + interval '30 days'
    and p.email is not null
    and (p.last_certification_reminder_sent_at is null or p.last_certification_reminder_sent_at < current_date)
  group by p.id, p.email, p.full_name, oem.custom_subject, oem.custom_message;
$$;

revoke all on function public.due_certification_reminders(text) from public;
grant execute on function public.due_certification_reminders(text) to anon, authenticated;

drop function if exists public.due_knowledge_hub_reminders(text);
create function public.due_knowledge_hub_reminders(secret text)
returns table(
  assignment_id uuid,
  user_id uuid,
  email text,
  full_name text,
  content_title text,
  due_date date,
  overdue boolean,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select a.id, u.id, u.email, p.full_name, c.title, c.due_date, (c.due_date < current_date),
    oem.custom_subject, oem.custom_message
  from public.knowledge_hub_assignments a
  join public.knowledge_hub_content c on c.id = a.content_id and c.archived_at is null
  join auth.users u on u.id = a.employee_user_id
  left join public.profiles p on p.id = u.id
  left join lateral (
    select om.organization_id from public.organization_members om where om.user_id = u.id limit 1
  ) org on true
  left join public.organization_email_messages oem
    on oem.organization_id = org.organization_id and oem.email_type = 'knowledge_hub_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and c.due_date is not null
    and c.due_date <= current_date + interval '7 days'
    and u.email is not null
    and not exists (
      select 1 from public.knowledge_hub_completions comp
      where comp.content_id = a.content_id and comp.employee_user_id = a.employee_user_id
    )
    and (a.last_reminder_sent_at is null or a.last_reminder_sent_at < now() - interval '3 days');
$$;

revoke all on function public.due_knowledge_hub_reminders(text) from public;
grant execute on function public.due_knowledge_hub_reminders(text) to anon, authenticated;

-- ============================================================
-- New: performance review (appraisal) reminders
-- ============================================================

alter table public.performance_reviews
  add column if not exists last_reminder_sent_at timestamptz;

-- Reminds the EMPLOYEE only, about their own not-yet-started self-
-- assessment on an open cycle — never a manager, never about someone
-- else's review. 7-day re-remind spacing, same cadence as Knowledge Hub.
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
    and (r.last_reminder_sent_at is null or r.last_reminder_sent_at < now() - interval '7 days');
$$;

revoke all on function public.due_performance_review_reminders(text) from public;
grant execute on function public.due_performance_review_reminders(text) to anon, authenticated;

create or replace function public.mark_performance_review_reminder_sent(secret text, target_review_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.performance_reviews set last_reminder_sent_at = now()
  where id = target_review_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_performance_review_reminder_sent(text, uuid) from public;
grant execute on function public.mark_performance_review_reminder_sent(text, uuid) to anon, authenticated;

-- ============================================================
-- New: assigned assessment reminders
-- ============================================================

alter table public.assigned_assessments
  add column if not exists last_reminder_sent_at timestamptz;

-- assigned_assessments has no due_date at all (it's an open-ended
-- assignment, not a deadline) — "due" here means "assigned more than 3
-- days ago and still not completed," giving someone a few days before the
-- first nudge, same 7-day re-remind spacing as the others.
--
-- assessment_slug can point into EITHER the self-report assessment catalog
-- (completion = a row in assessment_results) OR the timed Case Study
-- Exercise catalog (completion = a SUBMITTED row in
-- case_study_exercise_attempts) — see app/dashboard/assessments/page.tsx's
-- pendingAssigned computation for the exact same dual-path logic this
-- mirrors. assessment_slug is returned as-is (not resolved to a display
-- name) since that mapping lives in app code (lib/assessments/catalog.ts
-- etc.), not the database.
create or replace function public.due_assessment_reminders(secret text)
returns table(
  assignment_id uuid,
  employee_user_id uuid,
  email text,
  full_name text,
  assessment_slug text,
  organization_id uuid,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.employee_user_id, p.email, p.full_name, a.assessment_slug,
    org.organization_id, oem.custom_subject, oem.custom_message
  from public.assigned_assessments a
  join public.profiles p on p.id = a.employee_user_id
  left join lateral (
    select om.organization_id from public.organization_members om where om.user_id = a.employee_user_id limit 1
  ) org on true
  left join public.organization_email_messages oem
    on oem.organization_id = org.organization_id and oem.email_type = 'assessment_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and p.email is not null
    and a.created_at <= now() - interval '3 days'
    and (a.last_reminder_sent_at is null or a.last_reminder_sent_at < now() - interval '7 days')
    and not exists (
      select 1 from public.assessment_results res
      where res.user_id = a.employee_user_id and res.assessment_slug = a.assessment_slug
    )
    and not exists (
      select 1 from public.case_study_exercise_attempts att
      where att.user_id = a.employee_user_id and att.exercise_slug = a.assessment_slug and att.submitted_at is not null
    );
$$;

revoke all on function public.due_assessment_reminders(text) from public;
grant execute on function public.due_assessment_reminders(text) to anon, authenticated;

create or replace function public.mark_assessment_reminder_sent(secret text, target_assignment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.assigned_assessments set last_reminder_sent_at = now()
  where id = target_assignment_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_assessment_reminder_sent(text, uuid) from public;
grant execute on function public.mark_assessment_reminder_sent(text, uuid) to anon, authenticated;
