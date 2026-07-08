-- AI Discovery Interview: a short, guided (not free-form) set of fixed
-- questions, synthesized by AI into a narrative profile summary. Distinct
-- mechanism from the Coach (open-ended chat) and Gap Analysis (CV scoring).
create table if not exists public.discovery_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.discovery_profiles enable row level security;

create policy "Users can manage their own discovery profiles"
  on public.discovery_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists discovery_profiles_user_created_idx
  on public.discovery_profiles (user_id, created_at desc);
