-- 0107: Close the email-customization gap — widens organization_email_
-- messages to cover 8 more email types (4 that already existed but were
-- hardcoded, 4 that didn't exist as emails at all until this migration's
-- companion app code), relaxes its SELECT policy so non-admin-triggered
-- sends can still honor an admin's override, and adds the schema two new
-- cron-based reminder types need.
--
-- Why the SELECT policy changes: two of the newly-customizable emails
-- (hire_to_onboarding_manager_alert, high_potential_manager_alert) fire
-- from inside the TRIGGERING EMPLOYEE's own session, not an admin's (a new
-- hire signing up, or someone whose own Gap Analysis just ran) — this app
-- has no service-role key, so that read has to go through the same
-- RLS-bound client the request is already using. The 5 original reminder
-- types never hit this because they're read entirely inside SECURITY
-- DEFINER SQL functions (which bypass RLS); these two are read at the TS
-- level instead. Reading the customization TEXT isn't sensitive — it's
-- literally what gets emailed out — so member-read is the correct model;
-- only writing/managing it needs to stay admin-only, and those three
-- policies are untouched below.

-- 1. Widen the email_type check constraint (5 -> 13 values). It's an
-- unnamed inline constraint from 0101, so its actual name is looked up
-- rather than guessed, then replaced with an explicitly named one so a
-- future migration can reference it idempotently.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'organization_email_messages'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%email_type%';

  if constraint_name is not null then
    execute format('alter table public.organization_email_messages drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.organization_email_messages
  add constraint organization_email_messages_email_type_check
  check (email_type in (
    'task_reminder', 'certification_reminder', 'knowledge_hub_reminder',
    'performance_review_reminder', 'assessment_reminder',
    'knowledge_hub_assignment', 'employee_invite',
    'hire_to_onboarding_manager_alert', 'high_potential_manager_alert',
    'onboarding_step_reminder', 'onboarding_manager_approval_reminder',
    'milestone_assignment', 'interview_stage_notice'
  ));

-- 2. Relax SELECT: admin-only -> any org member. INSERT/UPDATE/DELETE stay
-- admin-gated (untouched below) — only reading the override text changes.
drop policy if exists "Org admins can view their email message overrides" on public.organization_email_messages;
drop policy if exists "Org members can view their org's email message overrides" on public.organization_email_messages;
create policy "Org members can view their org's email message overrides"
  on public.organization_email_messages for select
  using (public.is_org_member(organization_id));

-- 3. Re-remind spacing column for the two new onboarding reminder types.
-- One shared column is sufficient — step_type is exclusive, so a
-- manager_approval row is never also targeted by the employee-facing query.
alter table public.onboarding_instance_steps
  add column if not exists last_reminder_sent_at timestamptz;

-- 4. Employee-facing onboarding step reminder — task/knowledge_hub steps
-- only (never manager_approval, that's the separate function below).
-- onboarding_instances already carries organization_id directly, no
-- lateral org-lookup needed (unlike task/certification/assessment
-- reminders, whose source tables have no direct org column).
create or replace function public.due_onboarding_reminders(secret text)
returns table(
  step_id uuid,
  employee_user_id uuid,
  email text,
  full_name text,
  step_title text,
  due_date date,
  organization_id uuid,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select s.id, i.employee_user_id, p.email, p.full_name, s.title, s.due_date,
    i.organization_id, oem.custom_subject, oem.custom_message
  from public.onboarding_instance_steps s
  join public.onboarding_instances i on i.id = s.instance_id
  join public.profiles p on p.id = i.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = i.organization_id and oem.email_type = 'onboarding_step_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and s.step_type in ('task', 'knowledge_hub')
    and s.completed_at is null
    and p.email is not null
    and s.due_date is not null
    and s.due_date <= current_date
    and (s.last_reminder_sent_at is null or s.last_reminder_sent_at < now() - interval '7 days');
$$;

revoke all on function public.due_onboarding_reminders(text) from public;
grant execute on function public.due_onboarding_reminders(text) to anon, authenticated;

create or replace function public.mark_onboarding_reminder_sent(secret text, target_step_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.onboarding_instance_steps set last_reminder_sent_at = now()
  where id = target_step_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_onboarding_reminder_sent(text, uuid) from public;
grant execute on function public.mark_onboarding_reminder_sent(text, uuid) to anon, authenticated;

-- 5. Manager-facing onboarding approval nudge — manager_approval steps
-- only. Manager resolved via organization_members.manager_user_id, the
-- same relationship is_manager_of_user() (0078) encodes, written inline
-- here since the function needs the manager's own row, not just a boolean.
-- No due_date requirement — a pending approval has no deadline of its own,
-- it just nudges once it's sat unremimded for 7 days (same "no due date,
-- use elapsed time" shape as assigned_assessments in 0101).
create or replace function public.due_onboarding_manager_approval_reminders(secret text)
returns table(
  step_id uuid,
  manager_user_id uuid,
  email text,
  full_name text,
  employee_name text,
  step_title text,
  organization_id uuid,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select s.id, om.manager_user_id, mp.email, mp.full_name, ep.full_name, s.title,
    i.organization_id, oem.custom_subject, oem.custom_message
  from public.onboarding_instance_steps s
  join public.onboarding_instances i on i.id = s.instance_id
  join public.organization_members om on om.user_id = i.employee_user_id and om.organization_id = i.organization_id
  join public.profiles mp on mp.id = om.manager_user_id
  join public.profiles ep on ep.id = i.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = i.organization_id and oem.email_type = 'onboarding_manager_approval_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and s.step_type = 'manager_approval'
    and s.completed_at is null
    and om.manager_user_id is not null
    and mp.email is not null
    and (s.last_reminder_sent_at is null or s.last_reminder_sent_at < now() - interval '7 days');
$$;

revoke all on function public.due_onboarding_manager_approval_reminders(text) from public;
grant execute on function public.due_onboarding_manager_approval_reminders(text) to anon, authenticated;

create or replace function public.mark_onboarding_manager_approval_reminder_sent(secret text, target_step_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.onboarding_instance_steps set last_reminder_sent_at = now()
  where id = target_step_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_onboarding_manager_approval_reminder_sent(text, uuid) from public;
grant execute on function public.mark_onboarding_manager_approval_reminder_sent(text, uuid) to anon, authenticated;
