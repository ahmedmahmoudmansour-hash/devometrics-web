-- Personal daily-task execution layer: turns a milestone into concrete,
-- checkable daily/recurring steps. Deliberately private — this is NOT
-- visible to org admins at all, unlike the existing admin-assigned
-- milestones/tasks (migration 0031), which stay admin-visible because the
-- admin assigned them. This is the employee's own working layer, closer to
-- a personal to-do list than a performance record — no admin SELECT policy
-- exists here, by design, not by oversight.
create table if not exists public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  subtasks jsonb not null default '[]'::jsonb,
  recurring text not null default 'none' check (recurring in ('none', 'daily', 'weekdays', 'weekly')),
  date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.personal_tasks enable row level security;

drop policy if exists "Users can manage their own personal tasks" on public.personal_tasks;
create policy "Users can manage their own personal tasks"
  on public.personal_tasks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists personal_tasks_user_date_idx on public.personal_tasks (user_id, date);
