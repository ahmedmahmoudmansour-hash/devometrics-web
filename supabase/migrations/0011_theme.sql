-- Self-disclosed theme preference (dark/light), same philosophy as
-- accommodation and learning preference: color/contrast comfort is
-- individual, so offer a choice rather than assuming one is universally
-- better for any group.
alter table public.profiles
  add column if not exists theme text default 'dark';
