-- Free-text notes per task, same pattern as milestones.user_notes — lets
-- someone jot down progress/context for their own tracking, not a
-- structured field the AI reads back.
alter table public.personal_tasks
  add column if not exists notes text;
