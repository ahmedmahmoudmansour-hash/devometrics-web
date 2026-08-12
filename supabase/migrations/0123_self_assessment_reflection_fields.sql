-- 0123: Self-assessment gains Key Strengths / Recommendations / Development
-- Areas — Part 5(a) of the CEO's 2026-08-11 appraisal-simplification
-- request: "employee needs to ADD OBJECTIVES (goals), competencies...,
-- development area, key strength and recommendations... with final
-- conclusion." Goals already exist (performance_review_goals), competencies
-- already exist (performance_review_competency_ratings), and conclusion
-- already exists (performance_reviews.conclusion) — this adds the three
-- still-missing employee-authored fields.
--
-- Deliberately 3 new columns on the existing self-assessment row, NOT a new
-- workflow step type. These are employee-authored fields alongside the
-- existing rating/reflection on the SAME stage that already exists — a new
-- step_type would mean touching two check constraints, the workflow-editor
-- step picker, and a whole new response-storage table for what's
-- fundamentally 3 more text fields on a stage that already runs. The
-- step-type-extensibility model (migration 0103) is the right tool for a
-- genuinely new STAGE requiring a different party to act (which Part 4's
-- probation acceptance already used correctly) — not for adding fields to
-- an existing stage's payload.
--
-- submit_self_assessment's 3 new trailing parameters all default to null —
-- CREATE OR REPLACE FUNCTION can append new defaulted parameters to an
-- existing function without changing its identity, so every existing
-- 3-argument call site (lib/performanceReviews/actions.ts's
-- submitSelfAssessment, before this migration's TS-side update lands)
-- keeps working unchanged.

alter table public.performance_review_self_assessments
  add column if not exists key_strengths text,
  add column if not exists recommendations text,
  add column if not exists development_areas text;

create or replace function public.submit_self_assessment(
  target_review_id uuid,
  p_rating integer,
  p_reflection text,
  p_key_strengths text default null,
  p_recommendations text default null,
  p_development_areas text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
begin
  select employee_user_id into v_employee from public.performance_reviews where id = target_review_id;
  if v_employee is null or v_employee != auth.uid() then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_self_assessments
    (review_id, rating, reflection, key_strengths, recommendations, development_areas, submitted_at)
  values
    (target_review_id, p_rating, p_reflection, p_key_strengths, p_recommendations, p_development_areas, now())
  on conflict (review_id) do update
    set rating = excluded.rating,
        reflection = excluded.reflection,
        key_strengths = excluded.key_strengths,
        recommendations = excluded.recommendations,
        development_areas = excluded.development_areas,
        submitted_at = now(),
        updated_at = now();

  -- Only advances status forward from the starting point — resubmitting a
  -- self-assessment after the manager has already submitted theirs
  -- shouldn't regress the review's overall status.
  update public.performance_reviews
    set status = 'self_submitted'
    where id = target_review_id and status = 'not_started';
end;
$$;

revoke all on function public.submit_self_assessment(uuid, integer, text, text, text, text) from public;
grant execute on function public.submit_self_assessment(uuid, integer, text, text, text, text) to authenticated;
