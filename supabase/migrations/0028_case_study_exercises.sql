-- Timed Assessment Centre exercises: a detailed business case + written
-- response, scored by AI into a structured report (strengths/gaps/
-- recommendation) — a separate, deeper tier from the quick Likert
-- assessments and their embedded mini case studies.
create table if not exists public.case_study_exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_slug text not null,
  response_text text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer check (score >= 0 and score <= 100),
  report jsonb,
  created_at timestamptz not null default now()
);

alter table public.case_study_exercise_attempts enable row level security;

create policy "Users can manage their own case study exercise attempts"
  on public.case_study_exercise_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists case_study_exercise_attempts_user_idx
  on public.case_study_exercise_attempts (user_id, exercise_slug, created_at desc);
