-- The unit "weekly_hours" is displayed in ("week"/"month"/"quarter") — a
-- 3-year plan showing everything in weekly hours was exactly the kind of
-- overpromise-by-granularity we're trying to stop doing.
alter table public.milestones
  add column if not exists hours_period text default 'week';
