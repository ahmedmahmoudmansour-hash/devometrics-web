-- Persistent GROW-model (Goal, Reality, Options, Will) coaching memory — one
-- row per user, updated after each coach exchange, so a new conversation can
-- pick up "last time your goal was X and you committed to Y" instead of
-- starting cold every session. Same posture as every other personal table:
-- the user manages their own row only, no elevated access.
create table if not exists public.coach_grow_memory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goal text,
  reality text,
  options text,
  will text,
  updated_at timestamptz not null default now()
);

alter table public.coach_grow_memory enable row level security;

drop policy if exists "Users can manage their own GROW memory" on public.coach_grow_memory;
create policy "Users can manage their own GROW memory"
  on public.coach_grow_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
