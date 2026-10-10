-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0197, 0198, 0199  (run in this order)
--
-- 0197 hiring same-company integrity: a hiring row must belong to the same
--      company as the posting/candidate it points at.
-- 0198 Knowledge Hub: files readable only by admins + assigned employees;
--      bucket accepts the file types real SCORM packages contain; SCORM
--      completion records bounded.
-- 0199 Org chart: positions/snapshots/views/annotations admin-only; the
--      database refuses reporting loops.
-- Everything through 0196 is already applied and verified.
-- ============================================================

-- 0197: hiring same-company integrity
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


-- 0198: Knowledge Hub access + SCORM limits
-- 0198 -- Knowledge Hub: files are readable only by admins and the employees
-- they are assigned to; the SCORM bucket accepts the file types real packages
-- contain; completion records are bounded (rollout audit 2026-10-10).
--
-- 1. CONFIRMED live: any ordinary member of a company could download any file
--    in that company's Knowledge Hub folder -- including content assigned to
--    other people only (e.g. manager-only training) and the raw SCORM zips --
--    straight from Storage, and list the folder. The storage policy let "any
--    org member" read and left the "is it assigned to me" check to the app.
--    The read policy now requires: org admin, OR the caller has an assignment
--    for a content row whose storage_path is that object (documents) or its
--    parent folder (unpacked SCORM files). The app already required exactly
--    this before issuing a link, so nothing legitimate changes.
--    (The content ROWS -- title/description -- stay visible to members: manager
--    team views read them.)
--
-- 2. CONFIRMED live: the bucket's MIME allow-list rejected files a normal SCORM
--    1.2 package contains. The unpacker uploads each file with a guessed type;
--    anything unrecognised is application/octet-stream, which the bucket
--    refused ("mime type application/octet-stream is not supported"), so a
--    package with an .xsd/.txt/.webp/.ttf/.ico file failed to import. Adds
--    those types (and octet-stream as the catch-all). The bucket stays
--    private and admin-write-only; the app still validates uploads by type.
--
-- 3. submit_scorm_completion: a package's cmi_data larger than 100 KB is
--    stored as {} instead (the completion itself is still recorded) -- it was
--    unbounded -- and a learner can record at most 60 completions per content
--    per hour (it was unlimited, one new row per call).
--
-- Depends on 0084/0149/0151 (bucket, policies, RPC). The RPC keeps its exact
-- signature, so create-or-replace replaces it (no second overload).

-- 1. read policy
drop policy if exists "Org members can read their org's knowledge hub docs" on storage.objects;
drop policy if exists "Admins and assigned employees can read knowledge hub docs" on storage.objects;
create policy "Admins and assigned employees can read knowledge hub docs"
  on storage.objects for select
  using (
    bucket_id = 'knowledge-hub-docs'
    and (
      public.is_org_admin(((storage.foldername(name))[1])::uuid)
      or exists (
        select 1
        from public.knowledge_hub_assignments a
        join public.knowledge_hub_content c on c.id = a.content_id
        where a.employee_user_id = auth.uid()
          and (
            storage.objects.name = c.storage_path
            or starts_with(storage.objects.name, c.storage_path || '/')
          )
      )
    )
  );

-- 2. MIME allow-list
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m order by m)
  from unnest(
    coalesce(allowed_mime_types, '{}'::text[]) || array[
      'application/octet-stream',
      'text/plain',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'font/ttf',
      'font/otf',
      'application/vnd.ms-fontobject',
      'application/font-woff',
      'text/vtt',
      'audio/wav',
      'audio/ogg',
      'audio/x-m4a',
      'video/ogg'
    ]::text[]
  ) as m
)
where id = 'knowledge-hub-docs';

-- 3. SCORM completion bounds
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
  v_cmi jsonb := coalesce(p_cmi_data, '{}'::jsonb);
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

  if (select count(*) from public.knowledge_hub_completions
      where content_id = p_content_id and employee_user_id = auth.uid()
        and method = 'scorm' and completed_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many completions were recorded recently - try again later';
  end if;

  if octet_length(v_cmi::text) > 100000 then
    v_cmi := '{}'::jsonb;
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
    (p_content_id, auth.uid(), 'scorm', v_score, v_passed, v_cmi, now());

  return query select v_score, v_passed;
end;
$$;

revoke all on function public.submit_scorm_completion(uuid, numeric, text, jsonb) from public;
grant execute on function public.submit_scorm_completion(uuid, numeric, text, jsonb) to authenticated;


-- 0199: org chart admin-only + no reporting loops
-- 0199 -- Org chart: planning data is admin-only, and the database refuses
-- reporting loops (rollout audit 2026-10-10).
--
-- 1. CONFIRMED live: any ordinary member could read their company's vacant /
--    future / frozen positions, every saved chart snapshot and annotation, and
--    the saved views -- the data an admin uses to plan a restructure or
--    headcount change. The org chart page itself is admin-only and nothing
--    else in the app reads these tables as a member, so the member SELECT
--    policies served nothing but exposure. Dropped; admins keep full access
--    (their "for all" policies already cover SELECT, and positions gets an
--    explicit admin SELECT policy). Functions that read positions
--    (history_manager_label, delete/fill_org_position) are SECURITY DEFINER
--    and unaffected.
--
-- 2. CONFIRMED live: a direct write could make A manage B and B manage A. The
--    app's setMemberManager guards this, but the database did not, and a
--    closed loop has no root so both people dropped off the chart. A BEFORE
--    trigger now walks the chain (within the same company, at most 100 steps)
--    and refuses a manager_user_id that is the person themselves or leads back
--    to them. It fires only when manager_user_id is inserted or changed.
--    Existing rows are not touched.
--
-- Depends on 0072 (manager_user_id), 0105/0106/0121/0125 (the chart tables).

-- 1. admin-only planning data
drop policy if exists "Org members can view positions" on public.org_positions;
drop policy if exists "Org admins can view positions" on public.org_positions;
create policy "Org admins can view positions"
  on public.org_positions for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart snapshots" on public.org_chart_snapshots;
drop policy if exists "Org members can view org chart saved views" on public.org_chart_saved_views;
drop policy if exists "Org members can view org chart annotations" on public.org_chart_annotations;

-- 2. no reporting loops
create or replace function public.trg_members_no_reporting_loop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur uuid := new.manager_user_id;
  v_steps int := 0;
begin
  if v_cur is null then
    return new;
  end if;
  if v_cur = new.user_id then
    raise exception 'Someone cannot be their own manager' using errcode = '23514';
  end if;

  while v_cur is not null and v_steps < 100 loop
    if v_cur = new.user_id then
      raise exception 'That would create a reporting loop' using errcode = '23514';
    end if;
    select om.manager_user_id into v_cur
    from public.organization_members om
    where om.organization_id = new.organization_id and om.user_id = v_cur
    limit 1;
    v_steps := v_steps + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists organization_members_no_reporting_loop on public.organization_members;
create trigger organization_members_no_reporting_loop
  before insert or update of manager_user_id on public.organization_members
  for each row execute function public.trg_members_no_reporting_loop();
