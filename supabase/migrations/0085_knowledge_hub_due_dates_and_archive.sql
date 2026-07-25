-- Knowledge Hub follow-up: optional due dates + overdue reminders, and an
-- archive flag for retiring content without destroying completion history.
--
-- Archiving, not deleting: knowledge_hub_content cascades to
-- knowledge_hub_completions on delete (0084), and completions are the
-- append-only compliance audit trail that migration was built to protect.
-- A real delete of a mistakenly-uploaded document would also silently wipe
-- out every real completion record for anyone who'd already finished it.
-- archived_at hides content from admin/employee lists while keeping the
-- row (and its history) intact — same posture as
-- organization_members.archived elsewhere in this schema.

alter table public.knowledge_hub_content
  add column if not exists due_date date,
  add column if not exists archived_at timestamptz;

alter table public.knowledge_hub_assignments
  add column if not exists last_reminder_sent_at timestamptz;

-- Adds video templates to the allowed upload types (0084 only allowed
-- Word/PDF/Excel/PPT). File size stays capped at 50MB — that's Supabase's
-- Free-plan global hard ceiling, not something this bucket config can
-- exceed on its own; it only actually changes once the project moves to
-- a paid plan.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]::text[]
where id = 'knowledge-hub-docs';

-- Same cron + SECURITY DEFINER + shared-secret pattern as
-- due_certification_reminders (0074) — SQL language, secret checked as a
-- WHERE filter (a bad secret just returns zero rows, not a throw; this
-- isn't called from an RLS policy so the "helper must never throw" rule
-- from 0083 doesn't apply here). Piggybacks on the existing daily
-- task-reminders cron rather than a new Vercel Cron entry — the Hobby plan
-- caps a project at 2 cron jobs and this one is already at that cap
-- (task-reminders, purge-deletions).
create or replace function public.due_knowledge_hub_reminders(secret text)
returns table(
  assignment_id uuid,
  user_id uuid,
  email text,
  full_name text,
  content_title text,
  due_date date,
  overdue boolean
)
language sql
security definer
set search_path = public
as $$
  select a.id, u.id, u.email, p.full_name, c.title, c.due_date, (c.due_date < current_date)
  from public.knowledge_hub_assignments a
  join public.knowledge_hub_content c on c.id = a.content_id and c.archived_at is null
  join auth.users u on u.id = a.employee_user_id
  left join public.profiles p on p.id = u.id
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

create or replace function public.mark_knowledge_hub_reminder_sent(secret text, target_assignment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.knowledge_hub_assignments set last_reminder_sent_at = now()
  where id = target_assignment_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_knowledge_hub_reminder_sent(text, uuid) from public;
grant execute on function public.mark_knowledge_hub_reminder_sent(text, uuid) to anon, authenticated;

create index if not exists knowledge_hub_content_due_date_idx on public.knowledge_hub_content (due_date) where due_date is not null;
