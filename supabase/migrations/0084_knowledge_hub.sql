-- Knowledge Hub: HR-authored training documents, assigned to multiple
-- employees at once, completed via either a per-document MCQ exam scored
-- server-side or a simple "I confirm I've read this" attestation.
--
-- The hard problem this migration solves: with no service-role key, a
-- Next.js server action is exactly as RLS-bound as a raw PostgREST call
-- with the employee's own JWT — there is no privileged path. So the exam
-- answer key CANNOT live in a column an employee-readable table exposes
-- under any policy, no matter how the query is shaped. Fix: the correct
-- answer lives in its own table (knowledge_hub_exam_answer_keys) with NO
-- select policy for anyone except org admins — default-deny handles the
-- rest. Employees only ever see knowledge_hub_exam_questions (prompt +
-- options, no answer column exists there at all), and only via rows that
-- pass the assignment-scoped RLS policy below, which is enforced the same
-- way whether the caller is the app or a direct supabase-js call.
--
-- Exam scoring and completion writes go through SECURITY DEFINER RPCs
-- (get_knowledge_hub_exam_questions / submit_knowledge_hub_exam /
-- confirm_knowledge_hub_read), same "guarded state-transition write"
-- pattern as acknowledge_review (0076) — knowledge_hub_completions has NO
-- insert policy for authenticated at all, so the RPCs are the only path in.
--
-- Reuses is_org_admin_of_user / is_org_admin / is_org_member (0016) as-is —
-- no new RLS-embedded helper functions are introduced by this migration,
-- so the "SECURITY DEFINER helper used inside RLS must never throw" failure
-- mode (0083) doesn't apply here; every new policy uses either an existing
-- hardened helper or a plain inline exists()/equality check.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.knowledge_hub_content (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  mime_type text not null,
  completion_type text not null check (completion_type in ('exam', 'attestation')),
  passing_score_percent integer not null default 80 check (passing_score_percent between 1 and 100),
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No correct-answer column here, ever — see header note.
create table if not exists public.knowledge_hub_exam_questions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.knowledge_hub_content(id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- Physically separate table, deliberately: this is what makes the
-- leak-proofing real rather than an app-layer convention (same reasoning
-- as the self/manager assessment split in 0076).
create table if not exists public.knowledge_hub_exam_answer_keys (
  question_id uuid primary key references public.knowledge_hub_exam_questions(id) on delete cascade,
  correct_index integer not null
);

-- Mirrors assigned_assessments (0058) exactly.
create table if not exists public.knowledge_hub_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.knowledge_hub_content(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_user_id, content_id)
);

-- Append-only compliance/re-certification history — deliberately NOT
-- unique(employee_user_id, content_id) and NOT upsert-only like
-- assigned_assessments' completion semantics. Every attempt (exam retake or
-- repeat attestation) is its own row. No update/delete policy anywhere:
-- this is meant to be an immutable audit trail. Only insertable via the two
-- RPCs below — no direct insert policy for authenticated exists on this
-- table at all.
create table if not exists public.knowledge_hub_completions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.knowledge_hub_content(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('exam', 'attestation')),
  score_percent integer check (score_percent between 0 and 100),
  passed boolean not null,
  answers jsonb,
  completed_at timestamptz not null default now(),
  check (
    (method = 'exam' and score_percent is not null)
    or (method = 'attestation' and score_percent is null)
  )
);

alter table public.knowledge_hub_content enable row level security;
alter table public.knowledge_hub_exam_questions enable row level security;
alter table public.knowledge_hub_exam_answer_keys enable row level security;
alter table public.knowledge_hub_assignments enable row level security;
alter table public.knowledge_hub_completions enable row level security;

-- ============================================================
-- RLS: knowledge_hub_content
-- ============================================================

drop policy if exists "Org admins manage knowledge hub content" on public.knowledge_hub_content;
create policy "Org admins manage knowledge hub content"
  on public.knowledge_hub_content for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view their org's knowledge hub content" on public.knowledge_hub_content;
create policy "Org members can view their org's knowledge hub content"
  on public.knowledge_hub_content for select
  using (public.is_org_member(organization_id));

-- ============================================================
-- RLS: knowledge_hub_exam_questions (prompt + options only — safe)
-- ============================================================

drop policy if exists "Org admins manage knowledge hub exam questions" on public.knowledge_hub_exam_questions;
create policy "Org admins manage knowledge hub exam questions"
  on public.knowledge_hub_exam_questions for all
  using (
    exists (
      select 1 from public.knowledge_hub_content c
      where c.id = knowledge_hub_exam_questions.content_id
        and public.is_org_admin(c.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_hub_content c
      where c.id = knowledge_hub_exam_questions.content_id
        and public.is_org_admin(c.organization_id)
    )
  );

-- Assignment-scoped, not just org-membership-scoped — an employee can only
-- see questions for content actually assigned to them.
drop policy if exists "Assigned employees can view their exam questions" on public.knowledge_hub_exam_questions;
create policy "Assigned employees can view their exam questions"
  on public.knowledge_hub_exam_questions for select
  using (
    exists (
      select 1 from public.knowledge_hub_assignments a
      where a.content_id = knowledge_hub_exam_questions.content_id
        and a.employee_user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS: knowledge_hub_exam_answer_keys — org admins ONLY. No policy at all
-- for authenticated non-admins, by design: default-deny is the leak-proof.
-- ============================================================

drop policy if exists "Org admins manage knowledge hub answer keys" on public.knowledge_hub_exam_answer_keys;
create policy "Org admins manage knowledge hub answer keys"
  on public.knowledge_hub_exam_answer_keys for all
  using (
    exists (
      select 1 from public.knowledge_hub_exam_questions q
      join public.knowledge_hub_content c on c.id = q.content_id
      where q.id = knowledge_hub_exam_answer_keys.question_id
        and public.is_org_admin(c.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_hub_exam_questions q
      join public.knowledge_hub_content c on c.id = q.content_id
      where q.id = knowledge_hub_exam_answer_keys.question_id
        and public.is_org_admin(c.organization_id)
    )
  );

-- ============================================================
-- RLS: knowledge_hub_assignments (mirrors assigned_assessments exactly)
-- ============================================================

drop policy if exists "Org admins can assign knowledge hub content to their members" on public.knowledge_hub_assignments;
create policy "Org admins can assign knowledge hub content to their members"
  on public.knowledge_hub_assignments for insert
  with check (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Org admins can view knowledge hub assignments for their members" on public.knowledge_hub_assignments;
create policy "Org admins can view knowledge hub assignments for their members"
  on public.knowledge_hub_assignments for select
  using (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Org admins can remove knowledge hub assignments for their members" on public.knowledge_hub_assignments;
create policy "Org admins can remove knowledge hub assignments for their members"
  on public.knowledge_hub_assignments for delete
  using (public.is_org_admin_of_user(employee_user_id));

drop policy if exists "Employees can view their own knowledge hub assignments" on public.knowledge_hub_assignments;
create policy "Employees can view their own knowledge hub assignments"
  on public.knowledge_hub_assignments for select
  using (employee_user_id = auth.uid());

-- Multi-select bulk assign needs no new schema or RPC: the server action
-- inserts an array of rows in one .insert([...]) call; the with check above
-- is evaluated per row exactly like a single-row insert would be.

-- ============================================================
-- RLS: knowledge_hub_completions — SELECT only. No insert/update/delete
-- policy for authenticated exists on this table at all; every write goes
-- through submit_knowledge_hub_exam / confirm_knowledge_hub_read below.
-- ============================================================

drop policy if exists "Employees can view their own knowledge hub completions" on public.knowledge_hub_completions;
create policy "Employees can view their own knowledge hub completions"
  on public.knowledge_hub_completions for select
  using (employee_user_id = auth.uid());

drop policy if exists "Org admins can view knowledge hub completions for their members" on public.knowledge_hub_completions;
create policy "Org admins can view knowledge hub completions for their members"
  on public.knowledge_hub_completions for select
  using (public.is_org_admin_of_user(employee_user_id));

-- ============================================================
-- RPCs
-- ============================================================

-- Returns ONLY prompt+options+order — never touches
-- knowledge_hub_exam_answer_keys. Redundant with the RLS policy above by
-- design (defense in depth): even if this function were dropped, the
-- table's own RLS keeps a direct PostgREST call from an assigned employee
-- safe, and vice versa.
create or replace function public.get_knowledge_hub_exam_questions(p_content_id uuid)
returns table(question_id uuid, prompt text, options jsonb, order_index integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.knowledge_hub_content
    where id = p_content_id and completion_type = 'exam'
  ) then
    raise exception 'This content does not have an exam';
  end if;

  return query
    select q.id, q.prompt, q.options, q.order_index
    from public.knowledge_hub_exam_questions q
    where q.content_id = p_content_id
    order by q.order_index;
end;
$$;

revoke all on function public.get_knowledge_hub_exam_questions(uuid) from public;
grant execute on function public.get_knowledge_hub_exam_questions(uuid) to authenticated;

-- p_answers shape: [{"question_id": "<uuid>", "selected_index": 2}, ...]
-- Scores server-side against knowledge_hub_exam_answer_keys (readable here
-- because this function runs as its owner, not subject to that table's
-- RLS). Returns aggregate score/pass only — never per-question correctness
-- — so repeated legitimate retakes (recertification) can't be used to
-- reconstruct the key by elimination. 60s cooldown between attempts on the
-- same content narrows the brute-force window further for short exams.
create or replace function public.submit_knowledge_hub_exam(p_content_id uuid, p_answers jsonb)
returns table(score_percent integer, passed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_correct integer;
  v_passing integer;
  v_score integer;
  v_passed boolean;
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  select passing_score_percent into v_passing
  from public.knowledge_hub_content
  where id = p_content_id and completion_type = 'exam';

  if v_passing is null then
    raise exception 'This content does not have an exam';
  end if;

  if exists (
    select 1 from public.knowledge_hub_completions
    where content_id = p_content_id and employee_user_id = auth.uid()
      and completed_at > now() - interval '60 seconds'
  ) then
    raise exception 'Please wait before retrying this exam.';
  end if;

  select count(*) into v_total
  from public.knowledge_hub_exam_questions
  where content_id = p_content_id;

  if v_total = 0 then
    raise exception 'No questions found for this exam';
  end if;

  select count(distinct q.id) into v_correct
  from public.knowledge_hub_exam_questions q
  join public.knowledge_hub_exam_answer_keys k on k.question_id = q.id
  join jsonb_to_recordset(p_answers) as a(question_id uuid, selected_index integer)
    on a.question_id = q.id and a.selected_index = k.correct_index
  where q.content_id = p_content_id;

  v_score := round((v_correct::numeric / v_total::numeric) * 100);
  v_passed := v_score >= v_passing;

  insert into public.knowledge_hub_completions
    (content_id, employee_user_id, method, score_percent, passed, answers, completed_at)
  values
    (p_content_id, auth.uid(), 'exam', v_score, v_passed, p_answers, now());

  return query select v_score, v_passed;
end;
$$;

revoke all on function public.submit_knowledge_hub_exam(uuid, jsonb) from public;
grant execute on function public.submit_knowledge_hub_exam(uuid, jsonb) to authenticated;

create or replace function public.confirm_knowledge_hub_read(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.knowledge_hub_assignments
    where content_id = p_content_id and employee_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.knowledge_hub_content
    where id = p_content_id and completion_type = 'attestation'
  ) then
    raise exception 'This content requires an exam, not a read confirmation';
  end if;

  insert into public.knowledge_hub_completions
    (content_id, employee_user_id, method, score_percent, passed, answers, completed_at)
  values
    (p_content_id, auth.uid(), 'attestation', null, true, null, now());
end;
$$;

revoke all on function public.confirm_knowledge_hub_read(uuid) from public;
grant execute on function public.confirm_knowledge_hub_read(uuid) to authenticated;

-- ============================================================
-- Storage: private bucket, signed-URL reads
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-hub-docs',
  'knowledge-hub-docs',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {organization_id}/{content_id}/{file_name}

drop policy if exists "Org admins can upload knowledge hub docs" on storage.objects;
create policy "Org admins can upload knowledge hub docs"
  on storage.objects for insert
  with check (bucket_id = 'knowledge-hub-docs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can update knowledge hub docs" on storage.objects;
create policy "Org admins can update knowledge hub docs"
  on storage.objects for update
  using (bucket_id = 'knowledge-hub-docs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Org admins can delete knowledge hub docs" on storage.objects;
create policy "Org admins can delete knowledge hub docs"
  on storage.objects for delete
  using (bucket_id = 'knowledge-hub-docs' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

-- Any org member, not just specifically-assigned employees — the "is this
-- assigned to me" gate lives at the app layer (check knowledge_hub_
-- assignments before requesting a signed URL), matching how the rest of
-- this app separates "can physically open" from "shows up in your queue".
drop policy if exists "Org members can read their org's knowledge hub docs" on storage.objects;
create policy "Org members can read their org's knowledge hub docs"
  on storage.objects for select
  using (bucket_id = 'knowledge-hub-docs' and public.is_org_member(((storage.foldername(name))[1])::uuid));

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists knowledge_hub_content_org_idx on public.knowledge_hub_content (organization_id);
create index if not exists knowledge_hub_exam_questions_content_idx on public.knowledge_hub_exam_questions (content_id, order_index);
create index if not exists knowledge_hub_assignments_employee_idx on public.knowledge_hub_assignments (employee_user_id);
create index if not exists knowledge_hub_assignments_content_idx on public.knowledge_hub_assignments (content_id);
create index if not exists knowledge_hub_completions_employee_content_idx on public.knowledge_hub_completions (employee_user_id, content_id, completed_at desc);
