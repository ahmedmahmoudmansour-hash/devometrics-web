-- Daily email reminder for pending tasks (overdue + due today), sent by a
-- Vercel Cron job hitting app/api/cron/task-reminders. This app has no
-- service-role key, so a cron request (no Supabase session at all) can't
-- read across every user's personal_tasks through normal RLS — same
-- problem as the calendar feed (0050) and billing webhook (0044), same
-- fix: a security-definer function gated on a shared secret checked INSIDE
-- the function body. That matters because granting execute to anon/
-- authenticated (required for the app's own anon-key client to call it at
-- all) also makes the function reachable by anyone via Supabase's public
-- REST RPC endpoint — the in-function secret check is what stops that from
-- leaking every user's email + pending tasks, not the Bearer-token check
-- in the Next.js route (that only protects requests that go through this
-- app's own route, not direct PostgREST calls).

create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
-- No RLS policies granted at all — inaccessible via PostgREST to anon or
-- authenticated. Only readable from inside a security-definer function,
-- which bypasses RLS by running as the function's owner.
alter table public.app_secrets enable row level security;

-- Run this once with your own long random value (the same value you set as
-- the CRON_SECRET env var in Vercel):
-- insert into public.app_secrets (key, value) values ('cron_secret', 'PASTE_YOUR_CRON_SECRET_HERE')
--   on conflict (key) do update set value = excluded.value;

alter table public.profiles
  add column if not exists last_task_reminder_sent_at timestamptz;

-- Overdue = one-off (recurring = 'none') tasks past their date, matching
-- the exact semantics already used for the homepage's Overdue card
-- (lib/tasks/actions.ts listOverdueTasks) — a stale recurring instance
-- isn't a real overdue commitment, today's fresh instance replaces it.
-- Due today = anything (recurring or not) dated today. At most one email
-- per user per calendar day via last_task_reminder_sent_at.
create or replace function public.due_task_reminders(secret text)
returns table(user_id uuid, email text, full_name text, tasks jsonb)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name,
    jsonb_agg(
      jsonb_build_object('title', t.title, 'date', t.date, 'overdue', (t.recurring = 'none' and t.date < current_date))
      order by t.date
    )
  from public.personal_tasks t
  join public.profiles p on p.id = t.user_id
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and t.completed = false
    and p.email is not null
    and (t.date = current_date or (t.recurring = 'none' and t.date < current_date))
    and (p.last_task_reminder_sent_at is null or p.last_task_reminder_sent_at < current_date)
  group by p.id, p.email, p.full_name;
$$;

revoke all on function public.due_task_reminders(text) from public;
grant execute on function public.due_task_reminders(text) to anon, authenticated;

create or replace function public.mark_task_reminder_sent(secret text, target_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_task_reminder_sent_at = now()
  where id = target_user_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_task_reminder_sent(text, uuid) from public;
grant execute on function public.mark_task_reminder_sent(text, uuid) to anon, authenticated;
