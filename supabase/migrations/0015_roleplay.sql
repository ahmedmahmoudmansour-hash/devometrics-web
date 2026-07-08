-- Interview/scenario role-play simulator: a live, multi-turn conversation
-- where the AI plays the other person(s) in a workplace scenario and guides
-- the user through it, then synthesizes feedback grounded in the exchange.
-- Reuses the Coach's personalization pattern rather than inventing a new
-- one — same "full context" system-prompt approach, different persona.
create table if not exists public.roleplay_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_slug text not null,
  messages jsonb not null default '[]'::jsonb,
  feedback text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roleplay_sessions enable row level security;

create policy "Users can manage their own roleplay sessions"
  on public.roleplay_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists roleplay_sessions_user_created_idx
  on public.roleplay_sessions (user_id, created_at desc);

-- Admin read policy, consistent with the pilot admin view added in 0013 —
-- lets the pilot admin see engagement with this feature too.
create policy "Admins can view all roleplay sessions"
  on public.roleplay_sessions for select
  using (public.is_admin());
