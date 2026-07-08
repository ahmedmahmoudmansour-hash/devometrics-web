-- Big Five (OCEAN) self-assessment: a separate self-awareness snapshot, not
-- a competency to close a gap on. Deliberately not MBTI/FIRO-B (both
-- trademarked, licensed instruments) — this is our own item set against the
-- open, well-validated five-factor model.
create table if not exists public.big_five_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null,
  scores jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.big_five_profiles enable row level security;

create policy "Users can manage their own big five profiles"
  on public.big_five_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists big_five_profiles_user_created_idx
  on public.big_five_profiles (user_id, created_at desc);
