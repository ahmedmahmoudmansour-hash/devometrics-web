-- Resume Intelligence: ATS compatibility, keyword gap, achievement quality,
-- and visibility recommendations from a single AI pass. Scoped to resume
-- text only — no LinkedIn integration.
create table if not exists public.resume_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_role text,
  resume_text text not null,
  ats_score integer not null check (ats_score >= 0 and ats_score <= 100),
  achievement_score integer not null check (achievement_score >= 0 and achievement_score <= 100),
  overall_score integer not null check (overall_score >= 0 and overall_score <= 100),
  matched_keywords jsonb not null default '[]'::jsonb,
  missing_keywords jsonb not null default '[]'::jsonb,
  ats_issues jsonb not null default '[]'::jsonb,
  weak_bullets jsonb not null default '[]'::jsonb,
  visibility_recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.resume_analyses enable row level security;

create policy "Users can manage their own resume analyses"
  on public.resume_analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists resume_analyses_user_created_idx
  on public.resume_analyses (user_id, created_at desc);
