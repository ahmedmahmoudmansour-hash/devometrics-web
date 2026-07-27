-- Smart Hiring follow-up: AI-generated, competency-based interview
-- questions per posting. Closes a real gap in the original MVP — the flow
-- went straight from "CV scored" to "manager writes free-text notes" with
-- nothing in between to guide what to actually ask, so the notes (and the
-- AI assessment built from them) could end up thin or inconsistent across
-- interviewers. This gives every candidate for the same posting the same
-- baseline question set, generated from the posting's required
-- competencies (job_posting_competency_requirements) — decision support
-- for the interviewer to reference, never anything shown to a candidate.
--
-- Cached per posting (same pattern as ranking_report/ranking_generated_at,
-- added in 0088) rather than regenerated per candidate, since the
-- questions are a property of the role's requirements, not of any one
-- candidate.
alter table public.job_postings
  add column if not exists interview_questions jsonb,
  add column if not exists interview_questions_generated_at timestamptz;
