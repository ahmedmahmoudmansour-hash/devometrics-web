-- Phase 3 of the Unified Talent Intelligence Layer plan: SCORM 1.2 support
-- for Knowledge Hub. MVP is deliberately SCORM 1.2 only — no 2004, no
-- sequencing, no advanced suspend-data. See lib/knowledgeHub/scorm/ for the
-- ingestion (zip-bomb/path-traversal-safe, all limits enforced BEFORE any
-- decompression) and the runtime API adapter.
--
-- Depends on 0084 (knowledge_hub_content / knowledge_hub_completions) and
-- 0147 (score_events — the existing knowledge_hub_completions trigger from
-- that migration already covers this table unconditionally, so a SCORM
-- completion flows into score_events with ZERO changes needed there).

-- ============================================================
-- knowledge_hub_content: content_type distinguishes a plain uploaded
-- document/video from an unpacked SCORM package. scorm_launch_path is the
-- unpacked launch file's relative path (e.g. "index.html" or
-- "scormcontent/index.html"), read from imsmanifest.xml at ingestion time.
-- ============================================================

alter table public.knowledge_hub_content
  add column if not exists content_type text not null default 'document' check (content_type in ('document', 'scorm')),
  add column if not exists scorm_version text check (scorm_version in ('1.2')), -- 2004 added later, once 1.2 is proven
  add column if not exists scorm_launch_path text;

-- Widen knowledge_hub_content.completion_type (0084) to add 'scorm' — a
-- SCORM package reports its own pass/fail via the runtime adapter calling
-- submit_scorm_completion below, so it needs a third completion_type
-- distinct from the existing exam/attestation UI flows (KnowledgeHub
-- ContentViewer branches on this to skip rendering the exam/attestation
-- controls entirely for scorm content). Looked up via information_schema
-- rather than guessed, per this repo's migration discipline — Postgres
-- auto-names an inline single-column check constraint predictably most of
-- the time, but "most of the time" isn't good enough to hardcode.
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
    and cc.check_clause like '%exam%'
    and cc.check_clause like '%attestation%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.knowledge_hub_content drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.knowledge_hub_content
  add constraint knowledge_hub_content_completion_type_check
  check (completion_type in ('exam', 'attestation', 'scorm'));

-- ============================================================
-- knowledge_hub_completions (0084): widen method + the method/score_percent
-- pairing check to allow 'scorm'. THREE separate check constraints touch
-- this table (the plain method enum check; the compound check tying
-- method to score_percent's nullability; and score_percent's own standalone
-- `between 0 and 100` range check) — distinguished below by their actual
-- clause text. Note the range check's clause also contains the substring
-- "score_percent" (it's a check ON that column), so matching on that
-- substring ALONE is not enough to identify the compound constraint — an
-- earlier version of this migration did exactly that, which caused it to
-- also match (and wrongly drop-and-replace) the unrelated range check,
-- failing with "constraint already exists" once both matched rows tried to
-- create the same replacement name in one pass. Requiring 'exam' AND
-- 'attestation' alongside 'score_percent' is what actually isolates the
-- compound constraint, since the range check's clause contains neither.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select tc.constraint_name, cc.check_clause
    from information_schema.table_constraints tc
    join information_schema.check_constraints cc
      on cc.constraint_name = tc.constraint_name
      and cc.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'knowledge_hub_completions'
      and tc.constraint_type = 'CHECK'
  loop
    if r.check_clause like '%exam%' and r.check_clause like '%attestation%' and r.check_clause not like '%score_percent%' then
      execute format('alter table public.knowledge_hub_completions drop constraint %I', r.constraint_name);
      execute 'alter table public.knowledge_hub_completions add constraint knowledge_hub_completions_method_check check (method in (''exam'', ''attestation'', ''scorm''))';
    elsif r.check_clause like '%exam%' and r.check_clause like '%attestation%' and r.check_clause like '%score_percent%' then
      execute format('alter table public.knowledge_hub_completions drop constraint %I', r.constraint_name);
      execute $sql$alter table public.knowledge_hub_completions add constraint knowledge_hub_completions_method_score_check check (
        (method = 'exam' and score_percent is not null)
        or (method = 'attestation' and score_percent is null)
        or (method = 'scorm')
      )$sql$;
    end if;
  end loop;
end $$;

-- ============================================================
-- submit_scorm_completion — same "guarded state-transition write" RPC
-- pattern as submit_knowledge_hub_exam (0084): the only insert path into
-- knowledge_hub_completions for method='scorm', called by the runtime
-- adapter (lib/knowledgeHub/scorm/runtimeAdapter.ts) on LMSFinish/
-- LMSCommit. p_score_raw is whatever cmi.core.score.raw the package
-- reported — SCORM 1.2 doesn't guarantee a 0-100 range (that's just the
-- common convention), so an out-of-range value is stored as a null score
-- rather than raising: the completion itself (and its pass/fail) is still
-- worth recording even if a particular package's score doesn't fit our
-- percent column. p_cmi_data (raw cmi.* key/value pairs the adapter
-- buffered) is stored in the existing 'answers' jsonb column — reused
-- rather than adding a new column, same shape (a jsonb bag associated with
-- one completion attempt) as the exam path already uses it for.
create or replace function public.submit_scorm_completion(
  p_content_id uuid,
  p_score_raw numeric,
  p_lesson_status text,
  p_cmi_data jsonb default '{}'::jsonb
)
returns table(score_percent integer, passed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer;
  v_passed boolean;
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.knowledge_hub_content
    where id = p_content_id and content_type = 'scorm'
  ) then
    raise exception 'This content is not a SCORM package';
  end if;

  if p_lesson_status not in ('passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted') then
    raise exception 'Invalid SCORM lesson_status';
  end if;

  if p_score_raw is not null and p_score_raw between 0 and 100 then
    v_score := round(p_score_raw)::integer;
  else
    v_score := null;
  end if;
  v_passed := p_lesson_status in ('passed', 'completed');

  insert into public.knowledge_hub_completions
    (content_id, employee_user_id, method, score_percent, passed, answers, completed_at)
  values
    (p_content_id, auth.uid(), 'scorm', v_score, v_passed, coalesce(p_cmi_data, '{}'::jsonb), now());

  return query select v_score, v_passed;
end;
$$;

revoke all on function public.submit_scorm_completion(uuid, numeric, text, jsonb) from public;
grant execute on function public.submit_scorm_completion(uuid, numeric, text, jsonb) to authenticated;

-- ============================================================
-- Storage: allow zip uploads into the existing knowledge-hub-docs bucket.
-- No new storage RLS policies needed — the existing four policies (0084)
-- key entirely on the {organization_id}/... path prefix via
-- is_org_admin/is_org_member, which applies identically to the unpacked
-- scorm/ subpath convention ({organization_id}/{content_id}/scorm/...).
-- ============================================================

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/zip',
  'application/x-zip-compressed', -- what some Windows-originated zips report instead of application/zip
  'text/html', -- unpacked SCORM files re-uploaded individually (launch page, assets) land in this same bucket
  'application/javascript',
  'text/javascript',
  'text/css',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'application/json',
  'application/xml',
  'text/xml',
  'font/woff',
  'font/woff2',
  'audio/mpeg',
  'audio/mp4'
]::text[]
where id = 'knowledge-hub-docs';
