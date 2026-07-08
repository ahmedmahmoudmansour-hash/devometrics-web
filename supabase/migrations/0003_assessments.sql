-- Assessment results: one row per completed assessment attempt.
-- Assessment content (questions, bands) is static and lives in application code,
-- keyed by slug — only results are persisted.
create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assessment_slug text not null,
  score integer not null check (score >= 0 and score <= 100),
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);

alter table public.assessment_results enable row level security;

create policy "Users can manage their own assessment results"
  on public.assessment_results for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists assessment_results_user_slug_idx
  on public.assessment_results (user_id, assessment_slug, completed_at desc);
