-- Gap analyses: the flagship CV + job description + target role -> competency
-- gap map. One row per run; a user can re-run this as their situation changes.
create table if not exists public.gap_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_role text not null,
  job_description text not null,
  cv_text text not null,
  competencies jsonb not null default '[]'::jsonb,
  career_health_score integer not null default 0 check (career_health_score >= 0 and career_health_score <= 100),
  created_at timestamptz not null default now()
);

alter table public.gap_analyses enable row level security;

create policy "Users can manage their own gap analyses"
  on public.gap_analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists gap_analyses_user_created_idx
  on public.gap_analyses (user_id, created_at desc);
