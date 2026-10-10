-- 0197 -- Hiring rows must belong to the same company as the row they point at
-- (rollout audit 2026-10-10, CONFIRMED live: an admin of company X could insert
-- a hiring_candidates row in X whose posting_id was a posting of company Y --
-- RLS only checks the row's own organization_id, not the parent's).
--
-- Not reachable without knowing another company's random UUID, and it exposed
-- nothing, but it let one company's rows hang off another's parents (and be
-- removed by that company's cascade deletes), and unique(candidate_id) on
-- hiring_candidate_cv_scores / assessments let a stray row occupy a slot.
--
-- One generic BEFORE INSERT/UPDATE trigger function, attached to every
-- hiring table that points at a posting or a candidate: it looks up the parent's
-- organization_id and refuses the row when it differs. A NULL pointer (e.g.
-- organization_invites.candidate_id on an ordinary invite) is allowed.
-- Existing rows are unaffected unless they are updated.
--
-- Depends on 0088 (hiring tables), 0190 (private-by-default functions; trigger
-- functions need no grants).

create or replace function public.trg_hiring_same_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_table text := tg_argv[0];
  v_parent_col text := tg_argv[1];
  v_parent_id uuid;
  v_parent_org uuid;
begin
  v_parent_id := nullif(to_jsonb(new) ->> v_parent_col, '')::uuid;
  if v_parent_id is null then
    return new;
  end if;

  execute format('select organization_id from public.%I where id = $1', v_parent_table)
    into v_parent_org
    using v_parent_id;

  if v_parent_org is null or v_parent_org is distinct from new.organization_id then
    raise exception 'This record belongs to a different company than the % it points at', v_parent_table
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- posting pointers
drop trigger if exists hiring_same_company_posting on public.hiring_candidates;
create trigger hiring_same_company_posting
  before insert or update of organization_id, posting_id on public.hiring_candidates
  for each row execute function public.trg_hiring_same_company('job_postings', 'posting_id');

drop trigger if exists hiring_same_company_posting on public.job_posting_competency_requirements;
create trigger hiring_same_company_posting
  before insert or update of organization_id, posting_id on public.job_posting_competency_requirements
  for each row execute function public.trg_hiring_same_company('job_postings', 'posting_id');

drop trigger if exists hiring_same_company_posting on public.hiring_candidate_cv_scores;
create trigger hiring_same_company_posting
  before insert or update of organization_id, posting_id on public.hiring_candidate_cv_scores
  for each row execute function public.trg_hiring_same_company('job_postings', 'posting_id');

-- candidate pointers
drop trigger if exists hiring_same_company_candidate on public.hiring_candidate_cv_scores;
create trigger hiring_same_company_candidate
  before insert or update of organization_id, candidate_id on public.hiring_candidate_cv_scores
  for each row execute function public.trg_hiring_same_company('hiring_candidates', 'candidate_id');

drop trigger if exists hiring_same_company_candidate on public.hiring_candidate_interview_notes;
create trigger hiring_same_company_candidate
  before insert or update of organization_id, candidate_id on public.hiring_candidate_interview_notes
  for each row execute function public.trg_hiring_same_company('hiring_candidates', 'candidate_id');

drop trigger if exists hiring_same_company_candidate on public.hiring_candidate_assessments;
create trigger hiring_same_company_candidate
  before insert or update of organization_id, candidate_id on public.hiring_candidate_assessments
  for each row execute function public.trg_hiring_same_company('hiring_candidates', 'candidate_id');

drop trigger if exists hiring_same_company_candidate on public.hiring_candidate_stage_history;
create trigger hiring_same_company_candidate
  before insert or update of organization_id, candidate_id on public.hiring_candidate_stage_history
  for each row execute function public.trg_hiring_same_company('hiring_candidates', 'candidate_id');

drop trigger if exists hiring_same_company_candidate on public.organization_invites;
create trigger hiring_same_company_candidate
  before insert or update of organization_id, candidate_id on public.organization_invites
  for each row execute function public.trg_hiring_same_company('hiring_candidates', 'candidate_id');
