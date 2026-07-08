-- Adds a real time-of-day to tasks (previously date-only — the "Add to
-- calendar" export had its own separate one-off time picker, but the task
-- itself never stored one) and a "monthly" recurrence option alongside the
-- existing daily/weekdays/weekly set.
alter table public.personal_tasks
  add column if not exists time text;

alter table public.personal_tasks drop constraint if exists personal_tasks_recurring_check;
alter table public.personal_tasks
  add constraint personal_tasks_recurring_check
  check (recurring in ('none', 'daily', 'weekdays', 'weekly', 'monthly'));
