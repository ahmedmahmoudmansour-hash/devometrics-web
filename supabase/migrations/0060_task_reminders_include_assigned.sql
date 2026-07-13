-- Extends the daily task-reminder email (0054) to also cover tasks an
-- admin assigned to an employee (milestones with assigned_by set), not
-- just self-created personal_tasks. Previously an assigned task showed up
-- in the employee's plan but never triggered the nudge email — this closes
-- that gap by unioning both sources into the same reminder pipeline.
-- Same security-definer + shared-secret pattern as the rest of this
-- function (see 0054's comment for why the secret check has to live here).

create or replace function public.due_task_reminders(secret text)
returns table(user_id uuid, email text, full_name text, tasks jsonb)
language sql
security definer
set search_path = public
as $$
  with combined as (
    select
      t.user_id,
      t.title,
      t.date,
      (t.recurring = 'none' and t.date < current_date) as overdue
    from public.personal_tasks t
    where t.completed = false
      and (t.date = current_date or (t.recurring = 'none' and t.date < current_date))

    union all

    select
      dp.user_id,
      m.title,
      m.target_date as date,
      (m.target_date < current_date) as overdue
    from public.milestones m
    join public.development_plans dp on dp.id = m.plan_id
    where m.assigned_by is not null
      and m.completed = false
      and m.target_date is not null
      and m.target_date <= current_date
  )
  select p.id, p.email, p.full_name,
    jsonb_agg(
      jsonb_build_object('title', c.title, 'date', c.date, 'overdue', c.overdue)
      order by c.date
    )
  from combined c
  join public.profiles p on p.id = c.user_id
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and p.email is not null
    and (p.last_task_reminder_sent_at is null or p.last_task_reminder_sent_at < current_date)
  group by p.id, p.email, p.full_name;
$$;

revoke all on function public.due_task_reminders(text) from public;
grant execute on function public.due_task_reminders(text) to anon, authenticated;
