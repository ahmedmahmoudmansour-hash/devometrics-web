-- Priority and a single-emoji icon per task — inspired by Tiimo's visual
-- task list. Priority defaults to 'medium' rather than being required, so
-- existing tasks (and the AI breakdown/milestone paths, which don't set it)
-- don't need a backfill.
alter table public.personal_tasks
  add column if not exists priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  add column if not exists icon text;
