-- Optional performance review / objectives data as a third evidence source
-- alongside CV and job description — most relevant for Professional/
-- Manager/Executive career stages, optional for everyone else.
alter table public.gap_analyses
  add column if not exists performance_data text;
