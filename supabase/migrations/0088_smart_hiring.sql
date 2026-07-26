-- Smart Hiring MVP — the thin wedge: job posting -> candidate pipeline ->
-- CV scoring against the posting's required competencies -> manager-entered
-- interview notes scored by AI -> candidate ranking -> hire converts the
-- candidate into an org employee. Deliberately reuses existing engines
-- rather than inventing new ones:
--   - CV scoring calls lib/gap-analysis/extract.ts's extractCompetencies()
--     directly (never buildBackgroundContext, which is bound to the
--     logged-in user's own profile).
--   - Competency-requirement suggestions reuse lib/jobArchitecture's
--     suggestRoleGrading() — only its competencyRequirements output is
--     persisted here.
--   - Hire-to-employee conversion reuses the existing organization_invites /
--     checkAndConsumeInvite() flow (see additive column below), not a new
--     invite system.
--
-- Candidates never authenticate anywhere in this feature — every table
-- below is admin-only (single `for all` policy via is_org_admin), simpler
-- than the four-policy assignment-table shape used elsewhere (Knowledge
-- Hub, assigned_assessments) since there's no self-view case to cover.
-- The one deliberate exception is a narrow, precedented self-view policy
-- on hiring_candidate_cv_scores only (never on notes/assessments), needed
-- so a newly-hired signee's own CV competency score can seed their first
-- gap_analyses row at signup — mirrors organization_invites' own existing
-- "see invites addressed to my email" policy (0017), same verified-JWT-email
-- pattern, no new SECURITY DEFINER function.
--
-- employee_manager_notes (free text on a current employee) is deliberately
-- never AI-scored elsewhere in this codebase. hiring_candidate_interview_notes
-- and hiring_candidate_assessments are entirely separate tables/actions so
-- that principle is never at risk of blurring.

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  department text not null default '',
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  -- Admin-written/pasted JD text, fed to extractCompetencies as jobDescription.
  -- Deliberately no AI-JD-writer here — reuse of generateJobDescription
  -- (Job Architecture) is explicitly out of scope for this feature.
  job_description text not null default '',
  -- Input to suggestRoleGrading only; not shown to candidates.
  responsibilities text not null default '',
  -- Optional bridge to Job Architecture, never required. on delete set null
  -- so deleting a role never breaks a posting's history.
  linked_role_id uuid references public.job_roles(id) on delete set null,
  ranking_report jsonb,
  ranking_generated_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same shape as role_competency_requirements (0067) — the bridge to the
-- existing 8-dimension competency engine, scoped to a posting instead of a
-- permanent role.
create table if not exists public.job_posting_competency_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  posting_id uuid not null references public.job_postings(id) on delete cascade,
  dimension text not null,
  target_level int not null default 0 check (target_level between 0 and 100),
  unique (posting_id, dimension)
);

-- One candidate row per posting — deliberately no shared candidate identity
-- across postings for this MVP (confirmed with Ahmed; revisit only if
-- re-applications turn out to be common). One active CV per candidate
-- (re-upload overwrites the storage object and these columns) — no separate
-- documents table for this pass.
create table if not exists public.hiring_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  posting_id uuid not null references public.job_postings(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null default '',
  stage text not null default 'applied'
    check (stage in ('applied', 'phone_screen', 'interview', 'offer', 'hired', 'rejected')),
  cv_storage_path text,
  cv_file_name text,
  cv_file_size_bytes bigint check (cv_file_size_bytes is null or (cv_file_size_bytes > 0 and cv_file_size_bytes <= 8388608)),
  cv_mime_type text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only Kanban move log — one row per stage change, for a simple
-- audit trail of how a candidate moved through the pipeline.
create table if not exists public.hiring_candidate_stage_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.hiring_candidates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  moved_by uuid references auth.users(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- One row per candidate, upserted on (re-)score. This is the exact shape
-- that seeds the new employee's first gap_analyses row at hire time.
create table if not exists public.hiring_candidate_cv_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null unique references public.hiring_candidates(id) on delete cascade,
  posting_id uuid not null references public.job_postings(id) on delete cascade,
  target_role text not null,
  job_description text not null,
  cv_text text not null,
  competencies jsonb not null default '[]'::jsonb,
  career_health_score int not null default 0 check (career_health_score between 0 and 100),
  scored_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Manager-entered interview notes. Never touches employee_manager_notes —
-- entirely separate table/code path by design (see header comment).
create table if not exists public.hiring_candidate_interview_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.hiring_candidates(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

-- One row per candidate, upserted on regenerate. AI-generated from the
-- candidate's interview notes — decision support an admin reviews, never
-- auto-applied to a hiring decision.
create table if not exists public.hiring_candidate_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null unique references public.hiring_candidates(id) on delete cascade,
  assessment jsonb not null,
  based_on_note_count int not null default 0,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now()
);

alter table public.job_postings enable row level security;
alter table public.job_posting_competency_requirements enable row level security;
alter table public.hiring_candidates enable row level security;
alter table public.hiring_candidate_stage_history enable row level security;
alter table public.hiring_candidate_cv_scores enable row level security;
alter table public.hiring_candidate_interview_notes enable row level security;
alter table public.hiring_candidate_assessments enable row level security;

drop policy if exists "Org admins manage job postings" on public.job_postings;
create policy "Org admins manage job postings"
  on public.job_postings for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage job posting requirements" on public.job_posting_competency_requirements;
create policy "Org admins manage job posting requirements"
  on public.job_posting_competency_requirements for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage hiring candidates" on public.hiring_candidates;
create policy "Org admins manage hiring candidates"
  on public.hiring_candidates for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage hiring candidate stage history" on public.hiring_candidate_stage_history;
create policy "Org admins manage hiring candidate stage history"
  on public.hiring_candidate_stage_history for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage hiring candidate cv scores" on public.hiring_candidate_cv_scores;
create policy "Org admins manage hiring candidate cv scores"
  on public.hiring_candidate_cv_scores for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Narrow, precedented exception: lets a person who was just invited (via
-- markCandidateHired -> organization_invites) read their own pre-hire CV
-- competency score during their own signup, so checkAndConsumeInvite() can
-- seed their first gap_analyses row. Matched against the invite's stored
-- email against the authenticated user's own verified JWT email — never an
-- arbitrary client-supplied string. Never grants access to interview notes
-- or the AI assessment (those stay admin-only forever).
drop policy if exists "A signee can read their own pre-hire CV score" on public.hiring_candidate_cv_scores;
create policy "A signee can read their own pre-hire CV score"
  on public.hiring_candidate_cv_scores for select
  using (
    exists (
      select 1 from public.organization_invites i
      where i.candidate_id = hiring_candidate_cv_scores.candidate_id
        and lower(i.email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Org admins manage hiring candidate interview notes" on public.hiring_candidate_interview_notes;
create policy "Org admins manage hiring candidate interview notes"
  on public.hiring_candidate_interview_notes for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins manage hiring candidate assessments" on public.hiring_candidate_assessments;
create policy "Org admins manage hiring candidate assessments"
  on public.hiring_candidate_assessments for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists job_postings_org_idx on public.job_postings (organization_id, status);
create index if not exists job_posting_requirements_posting_idx on public.job_posting_competency_requirements (posting_id);
create index if not exists hiring_candidates_posting_idx on public.hiring_candidates (posting_id, stage);
create index if not exists hiring_candidates_org_idx on public.hiring_candidates (organization_id);
create index if not exists hiring_candidate_stage_history_candidate_idx on public.hiring_candidate_stage_history (candidate_id, created_at);
create index if not exists hiring_candidate_interview_notes_candidate_idx on public.hiring_candidate_interview_notes (candidate_id, created_at);

-- Bridges hire conversion to the existing invite flow: markCandidateHired()
-- inserts an organization_invites row with this set, and
-- checkAndConsumeInvite() reads it back after the new member row is
-- inserted to seed a gap_analyses row from hiring_candidate_cv_scores.
-- Additive, nullable, on delete set null — every existing invite query is
-- unaffected.
alter table public.organization_invites
  add column if not exists candidate_id uuid references public.hiring_candidates(id) on delete set null;

-- Private bucket for candidate CVs — same private-bucket-plus-signed-URL
-- pattern as Knowledge Hub (0084), but with an 8MB cap (matches
-- lib/fileExtraction/extract.ts's MAX_FILE_SIZE_BYTES for resumes, not
-- Knowledge Hub's 50MB training-content cap) and all four operations
-- (insert/update/delete/select) gated on is_org_admin — no member-read
-- policy, since only admins ever view a candidate's CV.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-cvs',
  'candidate-cvs',
  false,
  8388608,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Org admins can upload candidate cvs" on storage.objects;
create policy "Org admins can upload candidate cvs"
  on storage.objects for insert
  with check (bucket_id = 'candidate-cvs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can update candidate cvs" on storage.objects;
create policy "Org admins can update candidate cvs"
  on storage.objects for update
  using (bucket_id = 'candidate-cvs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can delete candidate cvs" on storage.objects;
create policy "Org admins can delete candidate cvs"
  on storage.objects for delete
  using (bucket_id = 'candidate-cvs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can read candidate cvs" on storage.objects;
create policy "Org admins can read candidate cvs"
  on storage.objects for select
  using (bucket_id = 'candidate-cvs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
