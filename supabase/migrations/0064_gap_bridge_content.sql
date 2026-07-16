-- "Bridge the gap" curated content — the differentiator over generic LMS
-- platforms: content generated FROM a person's actual measured Gap
-- Analysis score for one dimension, not pulled from a fixed course
-- catalog. One row per user per dimension (regenerating overwrites, same
-- cache-and-regenerate pattern as employee_assessment_summaries).
create table if not exists public.gap_bridge_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dimension text not null,
  target_role text not null,
  current_level int not null,
  target_level int not null,
  -- { diagnosticNote, recommendedActivity, microLesson: { title, body,
  --   knowledgeCheck: [{question, options[], correctIndex}] },
  --   reflectionQuestion, externalResources: [{title, url, source, description}] }
  content jsonb not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, dimension)
);

alter table public.gap_bridge_content enable row level security;

drop policy if exists "Users manage their own bridge content" on public.gap_bridge_content;
create policy "Users manage their own bridge content"
  on public.gap_bridge_content for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
