-- Personalization fields used to tailor the AI coach
alter table public.profiles
  add column if not exists location text,
  add column if not exists learning_preference text;

-- AI coach conversation history, so guidance and goals persist across sessions
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.coach_messages enable row level security;

create policy "Users can manage their own coach messages"
  on public.coach_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
