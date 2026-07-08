-- Supports running a Gap Analysis with just a target role name and no real
-- job description pasted — the AI infers typical responsibilities for the
-- role and estimates a realistic timeline, clearly flagged as inferred
-- rather than presented as if the user provided a real job posting.
alter table public.gap_analyses
  add column if not exists role_context_inferred boolean not null default false,
  add column if not exists estimated_timeline_months integer,
  add column if not exists timeline_rationale text;
