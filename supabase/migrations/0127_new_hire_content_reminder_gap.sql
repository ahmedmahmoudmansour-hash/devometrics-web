-- 0127: Remind new hires about undated Knowledge Hub content
--
-- Process-delay audit follow-up: due_knowledge_hub_reminders (0085/0101)
-- only ever fires when the CONTENT has a due_date, but new-hire content
-- (is_new_hire_content, migration 0120) is never required to have one —
-- most onboarding/reference documents are ongoing, not deadline-bound. A
-- new hire who never opens such a document today gets no reminder, ever.
--
-- due_date lives on knowledge_hub_content, not per-assignment, so it's
-- shared across every employee that content is assigned to — a per-hire
-- "due N days after their hire date" default isn't representable there
-- without turning one shared field into a per-assignment one, which is a
-- bigger schema change than this gap warrants. Instead this widens the
-- reminder query with an OR branch keyed off knowledge_hub_assignments.
-- created_at (the actual per-employee assignment timestamp) for the
-- specific case of undated new-hire content: still-incomplete after 7
-- days from assignment, then re-reminded every 3 days same as everything
-- else via the existing last_reminder_sent_at column.

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
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select a.id, u.id, u.email, p.full_name, c.title, c.due_date, coalesce(c.due_date < current_date, false),
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
    and u.email is not null
    and (
      (c.due_date is not null and c.due_date <= current_date + interval '7 days')
      or (c.due_date is null and c.is_new_hire_content and a.created_at <= now() - interval '7 days')
    )
    and not exists (
      select 1 from public.knowledge_hub_completions comp
      where comp.content_id = a.content_id and comp.employee_user_id = a.employee_user_id
    )
    and (a.last_reminder_sent_at is null or a.last_reminder_sent_at < now() - interval '3 days');
$$;

revoke all on function public.due_knowledge_hub_reminders(text) from public;
grant execute on function public.due_knowledge_hub_reminders(text) to anon, authenticated;
