-- Job application tracker — individual-experience feature, entirely private
-- to the user (same posture as personal_tasks, migration 0043): no admin
-- SELECT policy, org admins never see a member's job search. This is the
-- employee's own record of where they've applied, not a performance signal.
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role_title text not null,
  job_url text,
  location text,
  source text,
  stage text not null default 'saved' check (
    stage in ('saved', 'applied', 'phone_screen', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn')
  ),
  applied_date date,
  next_action text,
  next_action_date date,
  salary_range text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_applications enable row level security;

drop policy if exists "Users can manage their own job applications" on public.job_applications;
create policy "Users can manage their own job applications"
  on public.job_applications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists job_applications_user_stage_idx on public.job_applications (user_id, stage);
create index if not exists job_applications_next_action_idx on public.job_applications (user_id, next_action_date);
