-- Cache slot for the AI-extracted experience/education summary, computed
-- once per Gap Analysis run (not re-extracted on every profile page view).
alter table public.gap_analyses
  add column if not exists experience_summary text;
