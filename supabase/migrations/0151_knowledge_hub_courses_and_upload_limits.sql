-- Knowledge Hub: enterprise-grade uploads + multi-module courses.
--
-- Context: the old flat 50MB ceiling was enforced independently in four
-- places (Supabase plan tier, the knowledge-hub-docs bucket's own
-- file_size_limit, this table's own file_size_bytes check, and the app's
-- KNOWLEDGE_HUB_MAX_BYTES constant). Per-content-type limits now live in
-- lib/knowledgeHub/constants.ts (getKnowledgeHubMaxBytes) — up to 500MB for
-- video, 200MB for SCORM. This migration raises the two DB-level ceilings
-- to match the largest tier (500MB); the smaller per-type limits are
-- enforced in app code on top of this (client-side at file selection AND
-- server-side in createKnowledgeHubContent — see that function's comment).
--
-- SCORM stays deliberately below the video tier (200MB, not 500MB) because
-- SCORM packages are unzipped synchronously in one request (no async job
-- runner exists in this codebase) — a "learning journey" needing more than
-- one SCORM package's worth of content now groups multiple SCORM/video/
-- document modules into an ordered "course" instead (knowledge_hub_courses
-- below), rather than raising SCORM's own ceiling to match video.
--
-- Depends on 0084 (knowledge_hub_content) and 0149 (content_type/SCORM
-- columns) already having run.

-- ============================================================
-- Widen knowledge_hub_content.file_size_bytes (0084: <= 52428800) to
-- <= 524288000 (500MB). Looked up via information_schema rather than
-- guessed, per this repo's migration discipline — this column has exactly
-- one check constraint on this table, so matching on the column name alone
-- is unambiguous (unlike 0149's method/score_percent case, where two
-- different constraints both mentioned "score_percent").
-- ============================================================

do $$
declare
  existing_constraint text;
begin
  select tc.constraint_name into existing_constraint
  from information_schema.table_constraints tc
  join information_schema.check_constraints cc
    on cc.constraint_name = tc.constraint_name
    and cc.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'knowledge_hub_content'
    and tc.constraint_type = 'CHECK'
    and cc.check_clause like '%file_size_bytes%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.knowledge_hub_content drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.knowledge_hub_content
  add constraint knowledge_hub_content_file_size_bytes_check
  check (file_size_bytes > 0 and file_size_bytes <= 524288000);

update storage.buckets set file_size_limit = 524288000 where id = 'knowledge-hub-docs';

-- ============================================================
-- knowledge_hub_courses: a pure grouping/ordering wrapper around existing
-- knowledge_hub_content rows. Every module stays a normal
-- knowledge_hub_content row with its own assignment/completion/scoring
-- exactly as before courses existed — nothing here touches
-- knowledge_hub_completions, the exam/attestation/SCORM RPCs, or the
-- score_events trigger. No due_date/is_new_hire_content here: those stay
-- per-module, exactly as before courses existed, avoiding a "which due
-- date wins" question.
-- ============================================================

create table if not exists public.knowledge_hub_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_hub_courses enable row level security;

-- Same two-policy shape as knowledge_hub_content (0084).
drop policy if exists "Org admins manage knowledge hub courses" on public.knowledge_hub_courses;
create policy "Org admins manage knowledge hub courses"
  on public.knowledge_hub_courses for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view their org's knowledge hub courses" on public.knowledge_hub_courses;
create policy "Org members can view their org's knowledge hub courses"
  on public.knowledge_hub_courses for select
  using (public.is_org_member(organization_id));

-- course_id is "on delete set null", not cascade — deleting a course (only
-- ever allowed when it has zero linked modules, enforced in
-- deleteKnowledgeHubCourse) must never be able to take a module or its
-- completion history down with it, matching this codebase's existing
-- conservatism (see deleteKnowledgeHubContent's own comment).
alter table public.knowledge_hub_content
  add column if not exists course_id uuid references public.knowledge_hub_courses(id) on delete set null,
  add column if not exists course_position integer not null default 0;

create index if not exists knowledge_hub_content_course_idx on public.knowledge_hub_content (course_id, course_position);

-- Rules out two modules in the same course ever landing on the same
-- position (a reorder race) — cheap insurance even though admin-only
-- low-concurrency use makes it a low-probability event in practice.
create unique index if not exists knowledge_hub_content_course_position_uidx
  on public.knowledge_hub_content (course_id, course_position) where course_id is not null;
