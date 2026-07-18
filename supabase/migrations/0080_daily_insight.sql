-- One AI-generated insight per user per day, cached — the "daily insight
-- instead of daily tasks" mechanic: a reason to open the app because the
-- platform surfaces new intelligence about your own real data, not because
-- it wants a streak maintained. Caching by (user_id, date) means at most one
-- Claude call per person per day, not one per dashboard load.
create table if not exists public.career_gps_daily_insights (
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_date date not null,
  insight text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, insight_date)
);

alter table public.career_gps_daily_insights enable row level security;

drop policy if exists "Users can manage their own daily insights" on public.career_gps_daily_insights;
create policy "Users can manage their own daily insights"
  on public.career_gps_daily_insights for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
