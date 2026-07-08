-- Career stage, used to tailor the coach and gap analysis to students,
-- job seekers, and working professionals differently.
alter table public.profiles
  add column if not exists career_stage text;
