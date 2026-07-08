-- Engagement: streaks, achievements, and career-health momentum tracking —
-- plus the structured, LinkedIn-style career profile fields. Bundled in one
-- migration since they all ship together as this round's retention pack.

alter table public.profiles
  add column if not exists badges_enabled boolean not null default true,
  add column if not exists current_streak_days int not null default 0,
  add column if not exists longest_streak_days int not null default 0,
  add column if not exists last_active_date date,
  add column if not exists job_history jsonb not null default '[]'::jsonb,
  add column if not exists skills text[] not null default '{}',
  add column if not exists qualifications jsonb not null default '[]'::jsonb,
  add column if not exists career_aspirations text;

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

alter table public.user_achievements enable row level security;

drop policy if exists "Users can view their own achievements" on public.user_achievements;
create policy "Users can view their own achievements"
  on public.user_achievements for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own achievements" on public.user_achievements;
create policy "Users can insert their own achievements"
  on public.user_achievements for insert
  with check (user_id = auth.uid());

-- Needed for account data deletion (deleteMyData).
drop policy if exists "Users can delete their own achievements" on public.user_achievements;
create policy "Users can delete their own achievements"
  on public.user_achievements for delete
  using (user_id = auth.uid());

create table if not exists public.career_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  recorded_at timestamptz not null default now()
);

alter table public.career_health_snapshots enable row level security;

drop policy if exists "Users can view their own snapshots" on public.career_health_snapshots;
create policy "Users can view their own snapshots"
  on public.career_health_snapshots for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own snapshots" on public.career_health_snapshots;
create policy "Users can insert their own snapshots"
  on public.career_health_snapshots for insert
  with check (user_id = auth.uid());

-- Needed for account data deletion (deleteMyData).
drop policy if exists "Users can delete their own snapshots" on public.career_health_snapshots;
create policy "Users can delete their own snapshots"
  on public.career_health_snapshots for delete
  using (user_id = auth.uid());
