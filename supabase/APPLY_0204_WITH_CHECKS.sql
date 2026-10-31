-- ============================================================================
-- DEVOMETRICS: APPLY PACK FOR MIGRATION 0204 (role-based competency assessments)
-- DRAFT FOR REVIEW. Apply only after 0203 is applied and its checks pass.
--
-- Paste this whole file into the Supabase SQL Editor and press Run. One paste.
-- Step 1 makes the migration (it stops with a clear message if 0203 is missing).
-- Step 2 shows a check table at the end. Every row should say PASS.
-- It only adds new tables and functions. No existing table or row is changed.
-- To undo: run supabase/ROLLBACK_0204.sql.
-- ============================================================================

-- 0204: role-based competency assessments (DRAFT FOR REVIEW: do not apply until 0203 is applied and verified).
--
-- Design: "Assessment generation design v2" and "Scoring method 1.0" (31 Oct 2026).
--
-- What this adds (nothing existing is changed):
--   1. competency_assessment_settings    per-company settings (items per competency, cap, self-start, retention, retake interval)
--   2. competency_definition_versions    immutable snapshot of a competency's wording; results point at it, so editing a
--                                        competency later never changes a past result
--   3. competency_assessments            one assessment for one person, built from their role's requirements
--   4. competency_assessment_items       written questions, made once per definition version and level band and reused
--   5. competency_assessment_responses   the person's written answers (deleted after the retention period)
--   6. competency_assessment_results     per competency: Scored / Not assessed / Scoring failed, with evidence and confidence
--
-- Rules the database enforces (not only the application):
--   * Company isolation on every table, through the existing helpers is_org_member / is_org_admin / is_manager_of_user.
--   * A score exists only when the status is "scored". Not assessed and Scoring failed never carry a score (never zero).
--   * Definition versions are immutable: no update or delete policy, and they are created only through
--     record_competency_definition_version(), which reads a company competency's wording from the library itself.
--   * Items are immutable once written.
--   * Who can read written answers: the employee, their manager (organization_members.manager_user_id) and org admins.
--   * Answers can be edited only while the assessment is open, and only by the employee.
--   * Retention: purge_expired_competency_assessment_answers() blanks answers older than the company's retention period.
--
-- KNOWN LIMIT (stated plainly): this project has no service-role key, so the application writes results on the signed-in
-- user's own session. A technically skilled employee could therefore write their own result row. The pilot relies on
-- (a) a person confirming results before any promotion or succession use (confirmed_by / override columns, writable only
-- by the manager or an admin), and (b) results being labelled pilot evidence. A signed result, or an Edge Function with a
-- service key, would close this and is recommended before results support consequential decisions.
--
-- Not in this migration: feeding results into score_events (planned for 0205), the role gap view, Impact Cycle role targets.
--
-- Idempotent: safe to run more than once.

-- Requires 0203 (uses competency_level_indicators_valid and the library columns). Stops here if 0203 is not applied.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_competencies' and column_name = 'level_indicators'
  ) or to_regprocedure('public.competency_level_indicators_valid(jsonb)') is null then
    raise exception 'Apply migration 0203 first (competency library).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Settings (one row per company; defaults apply when a company has no row)
create table if not exists public.competency_assessment_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  items_per_competency integer not null default 3 check (items_per_competency between 1 and 10),
  max_competencies integer not null default 10 check (max_competencies between 1 and 30),
  self_start_allowed boolean not null default false,
  -- Proposal, to be confirmed with the client before the pilot.
  retention_months integer not null default 12 check (retention_months between 1 and 120),
  retake_interval_days integer not null default 30 check (retake_interval_days between 0 and 365),
  updated_at timestamptz not null default now()
);

alter table public.competency_assessment_settings enable row level security;

drop policy if exists "Members read assessment settings" on public.competency_assessment_settings;
create policy "Members read assessment settings"
  on public.competency_assessment_settings for select
  using (public.is_org_member(organization_id));

drop policy if exists "Admins write assessment settings" on public.competency_assessment_settings;
create policy "Admins write assessment settings"
  on public.competency_assessment_settings for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- 2. Definition versions (immutable)
create table if not exists public.competency_definition_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('standard', 'company')),
  -- The standard dimension name (for example 'Communication') or the company competency id as text. Never a display name.
  competency_key text not null check (char_length(competency_key) between 1 and 120),
  -- Set for a company competency. The snapshot survives deleting the competency.
  competency_id uuid references public.organization_competencies (id) on delete set null,
  -- Standard wording is per language; a company competency has one wording as the company wrote it.
  language text check (language in ('en', 'ar')),
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  level_indicators jsonb not null default '{}'::jsonb,
  wording_version text,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint competency_definition_versions_kind_shape check (
    (kind = 'standard' and language is not null and competency_id is null)
    or (kind = 'company')
  ),
  constraint competency_definition_versions_indicators_check check (public.competency_level_indicators_valid(level_indicators))
);

create unique index if not exists competency_definition_versions_uidx
  on public.competency_definition_versions (organization_id, kind, competency_key, coalesce(language, ''), fingerprint);

alter table public.competency_definition_versions enable row level security;

-- Read for company members. No insert, update or delete policy: versions are written only by the function below.
drop policy if exists "Members read definition versions" on public.competency_definition_versions;
create policy "Members read definition versions"
  on public.competency_definition_versions for select
  using (public.is_org_member(organization_id));

-- Same content -> same fingerprint. jsonb text is canonical (keys are ordered), so this is stable.
create or replace function public.competency_definition_fingerprint(p_name text, p_description text, p_indicators jsonb)
returns text
language sql
immutable
as $$
  select md5(coalesce(p_name, '') || E'\u0001' || coalesce(p_description, '') || E'\u0001' || coalesce(p_indicators, '{}'::jsonb)::text);
$$;

-- Returns the id of the snapshot for this definition, creating it only if this exact wording has not been saved before.
-- For a company competency the wording is read from the library here (the caller's text is ignored), so a snapshot can
-- never claim wording the company did not write.
create or replace function public.record_competency_definition_version(
  p_organization_id uuid,
  p_kind text,
  p_competency_key text,
  p_language text,
  p_name text,
  p_description text,
  p_level_indicators jsonb,
  p_wording_version text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := p_name;
  v_desc text := p_description;
  v_ind jsonb := coalesce(p_level_indicators, '{}'::jsonb);
  v_comp_id uuid := null;
  v_lang text := p_language;
  v_fp text;
  v_id uuid;
begin
  if p_organization_id is null or not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this company' using errcode = '42501';
  end if;
  if p_kind not in ('standard', 'company') then
    raise exception 'Unknown competency kind' using errcode = '22023';
  end if;

  if p_kind = 'company' then
    begin
      v_comp_id := p_competency_key::uuid;
    exception when others then
      raise exception 'Not a company competency id' using errcode = '22023';
    end;
    select name, description, level_indicators
      into v_name, v_desc, v_ind
    from public.organization_competencies
    where id = v_comp_id and organization_id = p_organization_id
    limit 1;
    if not found then
      raise exception 'The competency does not belong to this company' using errcode = '23514';
    end if;
    v_lang := null;
  else
    if v_lang is null or v_lang not in ('en', 'ar') then
      raise exception 'A standard competency needs a language' using errcode = '22023';
    end if;
  end if;

  v_fp := public.competency_definition_fingerprint(v_name, v_desc, v_ind);

  select id into v_id
  from public.competency_definition_versions
  where organization_id = p_organization_id and kind = p_kind and competency_key = p_competency_key
    and coalesce(language, '') = coalesce(v_lang, '') and fingerprint = v_fp
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.competency_definition_versions
    (organization_id, kind, competency_key, competency_id, language, name, description, level_indicators, wording_version, fingerprint)
  values
    (p_organization_id, p_kind, p_competency_key, v_comp_id, v_lang, v_name, v_desc, v_ind, p_wording_version, v_fp)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then -- a concurrent call saved the same version first
    select id into v_id
    from public.competency_definition_versions
    where organization_id = p_organization_id and kind = p_kind and competency_key = p_competency_key
      and coalesce(language, '') = coalesce(v_lang, '') and fingerprint = v_fp
    limit 1;
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_competency_definition_version(uuid, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.record_competency_definition_version(uuid, text, text, text, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Assessments
create table if not exists public.competency_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid references public.job_roles (id) on delete set null,
  -- Copied in, so the assessment still reads correctly if the role is later changed or deleted.
  role_title text not null default '',
  role_level text not null default '',
  route text not null check (route in ('assigned', 'self')),
  assigned_by uuid references auth.users (id) on delete set null,
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'submitted', 'scored', 'scoring_failed')),
  language text not null check (language in ('en', 'ar')),
  items_per_competency integer not null check (items_per_competency between 1 and 10),
  method_version text not null default '1.0',
  -- What the role required when the assessment was made: [{competency_key, kind, definition_version_id, required_target, required_level}]
  required_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(required_snapshot) = 'array'),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  scored_at timestamptz
);

create index if not exists competency_assessments_employee_idx on public.competency_assessments (employee_user_id, created_at desc);
create index if not exists competency_assessments_org_idx on public.competency_assessments (organization_id, created_at desc);

alter table public.competency_assessments enable row level security;

-- A company's self-start switch, readable from a policy without exposing the settings table.
create or replace function public.competency_assessment_self_start_allowed(p_org uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return coalesce((select self_start_allowed from public.competency_assessment_settings where organization_id = p_org limit 1), false);
exception when others then
  return false;
end;
$$;

revoke all on function public.competency_assessment_self_start_allowed(uuid) from public;
grant execute on function public.competency_assessment_self_start_allowed(uuid) to authenticated;

drop policy if exists "Read own, managed and company assessments" on public.competency_assessments;
create policy "Read own, managed and company assessments"
  on public.competency_assessments for select
  using (
    employee_user_id = auth.uid()
    or public.is_manager_of_user(employee_user_id)
    or public.is_org_admin(organization_id)
  );

drop policy if exists "Assign or self-start assessments" on public.competency_assessments;
create policy "Assign or self-start assessments"
  on public.competency_assessments for insert
  with check (
    (route = 'assigned' and assigned_by = auth.uid()
      and (public.is_org_admin(organization_id) or public.is_manager_of_user(employee_user_id)))
    or (route = 'self' and employee_user_id = auth.uid() and assigned_by is null
      and public.is_org_member(organization_id) and public.competency_assessment_self_start_allowed(organization_id))
  );

-- The employee moves their own assessment forward; a manager or admin can also move it (for example to retry scoring).
drop policy if exists "Update own or managed assessments" on public.competency_assessments;
create policy "Update own or managed assessments"
  on public.competency_assessments for update
  using (employee_user_id = auth.uid() or public.is_manager_of_user(employee_user_id) or public.is_org_admin(organization_id))
  with check (employee_user_id = auth.uid() or public.is_manager_of_user(employee_user_id) or public.is_org_admin(organization_id));

-- An admin or the assigning manager can withdraw an assessment that has not been submitted.
drop policy if exists "Withdraw unsubmitted assessments" on public.competency_assessments;
create policy "Withdraw unsubmitted assessments"
  on public.competency_assessments for delete
  using (
    status in ('assigned', 'in_progress')
    and (public.is_org_admin(organization_id) or (assigned_by = auth.uid() and public.is_manager_of_user(employee_user_id)))
  );

-- ---------------------------------------------------------------------------
-- 4. Items (written once per definition version, level band and language; reused for everyone)
create table if not exists public.competency_assessment_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  definition_version_id uuid not null references public.competency_definition_versions (id) on delete cascade,
  required_band integer not null check (required_band between 1 and 5),
  language text not null check (language in ('en', 'ar')),
  position integer not null check (position between 1 and 10),
  style text not null check (style in ('scenario', 'case', 'situational')),
  prompt text not null check (char_length(prompt) between 10 and 1500),
  model text,
  created_at timestamptz not null default now(),
  unique (definition_version_id, required_band, language, position)
);

alter table public.competency_assessment_items enable row level security;

drop policy if exists "Members read assessment items" on public.competency_assessment_items;
create policy "Members read assessment items"
  on public.competency_assessment_items for select
  using (public.is_org_member(organization_id));

drop policy if exists "Members write assessment items" on public.competency_assessment_items;
create policy "Members write assessment items"
  on public.competency_assessment_items for insert
  with check (public.is_org_member(organization_id));
-- No update or delete policy: items are immutable once written.

-- ---------------------------------------------------------------------------
-- 5. Responses (created empty when the assessment is made; the link between a person and the items they were given)
create table if not exists public.competency_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.competency_assessments (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.competency_assessment_items (id) on delete restrict,
  response_text text check (response_text is null or char_length(response_text) <= 6000),
  submitted_at timestamptz,
  purged_at timestamptz,
  unique (assessment_id, item_id)
);

create index if not exists competency_assessment_responses_assessment_idx on public.competency_assessment_responses (assessment_id);

alter table public.competency_assessment_responses enable row level security;

drop policy if exists "Read own, managed and company responses" on public.competency_assessment_responses;
create policy "Read own, managed and company responses"
  on public.competency_assessment_responses for select
  using (
    employee_user_id = auth.uid()
    or public.is_manager_of_user(employee_user_id)
    or public.is_org_admin(organization_id)
  );

-- Whoever makes the assessment writes its empty response rows.
drop policy if exists "Create response rows" on public.competency_assessment_responses;
create policy "Create response rows"
  on public.competency_assessment_responses for insert
  with check (
    exists (
      select 1 from public.competency_assessments a
      where a.id = assessment_id
        and (a.assigned_by = auth.uid() or a.employee_user_id = auth.uid())
    )
  );

-- Only the employee writes their own answers, and only while the assessment is open.
drop policy if exists "Employee writes own answers" on public.competency_assessment_responses;
create policy "Employee writes own answers"
  on public.competency_assessment_responses for update
  using (
    employee_user_id = auth.uid()
    and exists (select 1 from public.competency_assessments a where a.id = assessment_id and a.status in ('assigned', 'in_progress'))
  )
  with check (employee_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Results
create table if not exists public.competency_assessment_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assessment_id uuid not null references public.competency_assessments (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  definition_version_id uuid not null references public.competency_definition_versions (id) on delete restrict,
  competency_key text not null,
  -- What the role required at the time (0-100 target and its level 1-5).
  required_target integer check (required_target is null or required_target between 0 and 100),
  required_level integer check (required_level is null or required_level between 1 and 5),
  status text not null check (status in ('scored', 'not_assessed', 'scoring_failed')),
  not_assessed_reason text check (not_assessed_reason in ('too_few_answers', 'insufficient_evidence', 'no_level_reached')),
  level integer check (level between 1 and 5),
  range_low integer check (range_low between 1 and 5),
  range_high integer check (range_high between 1 and 5),
  score integer check (score between 1 and 100),
  score_low integer check (score_low between 1 and 100),
  score_high integer check (score_high between 1 and 100),
  confidence text check (confidence in ('low', 'medium', 'high')),
  confidence_reasons jsonb not null default '[]'::jsonb,
  -- Average evidence per level (0-2) and the verified quotes it rests on.
  evidence_levels jsonb,
  evidence_quotes jsonb not null default '[]'::jsonb,
  rationale text check (rationale is null or char_length(rationale) <= 2000),
  next_level_gap text check (next_level_gap is null or char_length(next_level_gap) <= 1000),
  method_version text not null default '1.0',
  judgements integer not null default 2 check (judgements between 1 and 5),
  model text,
  scored_at timestamptz not null default now(),
  -- A person confirms or overrides before a result supports a decision. Writable only by the manager or an admin.
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  override_level integer check (override_level between 1 and 5),
  override_reason text check (override_reason is null or char_length(override_reason) <= 1000),
  unique (assessment_id, definition_version_id),
  -- A score exists only for a scored result. Never a zero, never a score for "not assessed".
  constraint competency_results_score_only_when_scored check (
    (status = 'scored') = (score is not null)
  ),
  constraint competency_results_scored_shape check (
    status <> 'scored'
    or (level is not null and range_low is not null and range_high is not null
        and score_low is not null and score_high is not null and confidence is not null
        and range_low <= level and level <= range_high
        and score_low <= score and score <= score_high)
  ),
  constraint competency_results_unscored_shape check (
    status = 'scored'
    or (level is null and range_low is null and range_high is null and score_low is null and score_high is null)
  ),
  constraint competency_results_reason_shape check (
    (status = 'not_assessed') = (not_assessed_reason is not null)
  ),
  constraint competency_results_override_reason check (
    override_level is null or (override_reason is not null and confirmed_by is not null)
  )
);

create index if not exists competency_assessment_results_employee_idx on public.competency_assessment_results (employee_user_id, scored_at desc);
create index if not exists competency_assessment_results_org_idx on public.competency_assessment_results (organization_id, competency_key);

alter table public.competency_assessment_results enable row level security;

drop policy if exists "Read own, managed and company results" on public.competency_assessment_results;
create policy "Read own, managed and company results"
  on public.competency_assessment_results for select
  using (
    employee_user_id = auth.uid()
    or public.is_manager_of_user(employee_user_id)
    or public.is_org_admin(organization_id)
  );

-- The application writes results on the person's own session (see KNOWN LIMIT above), or on a manager's or admin's.
drop policy if exists "Write results" on public.competency_assessment_results;
create policy "Write results"
  on public.competency_assessment_results for insert
  with check (
    employee_user_id = auth.uid() or public.is_manager_of_user(employee_user_id) or public.is_org_admin(organization_id)
  );

-- Only a manager or an admin can confirm or override. The employee may only re-run a result that failed (guarded by the trigger).
drop policy if exists "Confirm, override or retry results" on public.competency_assessment_results;
create policy "Confirm, override or retry results"
  on public.competency_assessment_results for update
  using (
    public.is_manager_of_user(employee_user_id) or public.is_org_admin(organization_id)
    or (employee_user_id = auth.uid() and status = 'scoring_failed')
  )
  with check (
    public.is_manager_of_user(employee_user_id) or public.is_org_admin(organization_id) or employee_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Integrity (same-company and who-may-change-what), enforced even if the application is bypassed
create or replace function public.enforce_competency_assessment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a record;
  v_item_org uuid;
  v_def_org uuid;
begin
  if tg_table_name = 'competency_assessments' then
    -- The person must belong to the company named on the assessment, and so must the role.
    if not exists (select 1 from public.organization_members where user_id = new.employee_user_id and organization_id = new.organization_id) then
      raise exception 'The employee does not belong to this company' using errcode = '23514';
    end if;
    if new.role_id is not null and not exists (select 1 from public.job_roles where id = new.role_id and organization_id = new.organization_id) then
      raise exception 'The role does not belong to this company' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' then
      -- What was assessed and for whom is fixed once the assessment exists.
      if new.employee_user_id is distinct from old.employee_user_id
         or new.organization_id is distinct from old.organization_id
         or new.route is distinct from old.route
         or new.language is distinct from old.language
         or new.items_per_competency is distinct from old.items_per_competency
         or new.required_snapshot is distinct from old.required_snapshot
         or new.method_version is distinct from old.method_version
         or new.created_at is distinct from old.created_at then
        raise exception 'An assessment cannot be changed after it is created' using errcode = '23514';
      end if;
      -- Status only moves forward (a failed scoring can be retried).
      if old.status <> new.status and not (
           (old.status = 'assigned' and new.status in ('in_progress', 'submitted'))
        or (old.status = 'in_progress' and new.status = 'submitted')
        or (old.status = 'submitted' and new.status in ('scored', 'scoring_failed'))
        or (old.status = 'scoring_failed' and new.status in ('scored', 'scoring_failed'))
      ) then
        raise exception 'That status change is not allowed' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  select id, organization_id, employee_user_id, status into v_a from public.competency_assessments where id = new.assessment_id;
  if v_a.id is null or v_a.organization_id <> new.organization_id or v_a.employee_user_id <> new.employee_user_id then
    raise exception 'The assessment does not match this company and person' using errcode = '23514';
  end if;

  if tg_table_name = 'competency_assessment_responses' then
    select organization_id into v_item_org from public.competency_assessment_items where id = new.item_id;
    if v_item_org is null or v_item_org <> new.organization_id then
      raise exception 'The item does not belong to this company' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' then
      if new.assessment_id is distinct from old.assessment_id or new.item_id is distinct from old.item_id
         or new.employee_user_id is distinct from old.employee_user_id or new.organization_id is distinct from old.organization_id then
        raise exception 'A response cannot be moved' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'competency_assessment_results' then
    select organization_id into v_def_org from public.competency_definition_versions where id = new.definition_version_id;
    if v_def_org is null or v_def_org <> new.organization_id then
      raise exception 'The definition version does not belong to this company' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' then
      if new.assessment_id is distinct from old.assessment_id or new.definition_version_id is distinct from old.definition_version_id
         or new.employee_user_id is distinct from old.employee_user_id or new.organization_id is distinct from old.organization_id
         or new.competency_key is distinct from old.competency_key then
        raise exception 'A result cannot be moved' using errcode = '23514';
      end if;
      -- The employee can only re-run a failed result; confirming or overriding is for a manager or an admin.
      if auth.uid() = new.employee_user_id and not (public.is_manager_of_user(new.employee_user_id) or public.is_org_admin(new.organization_id)) then
        if old.status <> 'scoring_failed'
           or new.confirmed_by is distinct from old.confirmed_by or new.confirmed_at is distinct from old.confirmed_at
           or new.override_level is distinct from old.override_level or new.override_reason is distinct from old.override_reason then
          raise exception 'Only a manager or an admin can confirm or override a result' using errcode = '23514';
        end if;
      end if;
    elsif tg_op = 'INSERT' then
      -- A new result is never born confirmed.
      if new.confirmed_by is not null or new.override_level is not null then
        raise exception 'A new result cannot be confirmed or overridden' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists competency_assessments_integrity on public.competency_assessments;
create trigger competency_assessments_integrity
  before insert or update on public.competency_assessments
  for each row execute function public.enforce_competency_assessment_integrity();

drop trigger if exists competency_responses_integrity on public.competency_assessment_responses;
create trigger competency_responses_integrity
  before insert or update on public.competency_assessment_responses
  for each row execute function public.enforce_competency_assessment_integrity();

drop trigger if exists competency_results_integrity on public.competency_assessment_results;
create trigger competency_results_integrity
  before insert or update on public.competency_assessment_results
  for each row execute function public.enforce_competency_assessment_integrity();

-- ---------------------------------------------------------------------------
-- Retention: blank written answers older than the company's retention period. Safe for any member of the company to
-- trigger (it only removes expired answers and returns how many), so the application can call it on page load.
create or replace function public.purge_expired_competency_assessment_answers(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months integer;
  v_n integer := 0;
begin
  if p_organization_id is null or not public.is_org_member(p_organization_id) then
    return 0;
  end if;
  select coalesce((select retention_months from public.competency_assessment_settings where organization_id = p_organization_id limit 1), 12)
    into v_months;
  update public.competency_assessment_responses r
     set response_text = null, purged_at = now()
   where r.organization_id = p_organization_id
     and r.response_text is not null
     and coalesce(r.submitted_at, (select a.created_at from public.competency_assessments a where a.id = r.assessment_id))
         < now() - make_interval(months => v_months);
  get diagnostics v_n = row_count;
  return v_n;
exception when others then
  return 0;
end;
$$;

revoke all on function public.purge_expired_competency_assessment_answers(uuid) from public;
grant execute on function public.purge_expired_competency_assessment_answers(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Checks (the last result shown). Every row should say PASS.
select check_name, case when ok then 'PASS' else 'FAIL' end as result, detail
from (
  select 'six new tables exist' as check_name,
         (select count(*) from information_schema.tables where table_schema = 'public'
            and table_name in ('competency_assessment_settings','competency_definition_versions','competency_assessments',
                               'competency_assessment_items','competency_assessment_responses','competency_assessment_results')) = 6 as ok,
         'settings, definition versions, assessments, items, responses, results' as detail
  union all
  select 'row level security is on for all six',
         (select count(*) from pg_tables where schemaname = 'public' and rowsecurity
            and tablename in ('competency_assessment_settings','competency_definition_versions','competency_assessments',
                              'competency_assessment_items','competency_assessment_responses','competency_assessment_results')) = 6,
         'rowsecurity = true'
  union all
  select 'definition versions have no write policy (immutable)',
         not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'competency_definition_versions' and cmd <> 'SELECT'),
         'read-only for everyone; written only by the function'
  union all
  select 'the snapshot function exists',
         to_regprocedure('public.record_competency_definition_version(uuid,text,text,text,text,text,jsonb,text)') is not null,
         'record_competency_definition_version'
  union all
  select 'integrity triggers are in place',
         (select count(*) from pg_trigger where not tgisinternal
            and tgname in ('competency_assessments_integrity','competency_responses_integrity','competency_results_integrity')) = 3,
         'three triggers'
  union all
  select 'the retention function exists',
         to_regprocedure('public.purge_expired_competency_assessment_answers(uuid)') is not null,
         'purge_expired_competency_assessment_answers'
  union all
  select 'no score can exist without a scored status',
         exists (select 1 from pg_constraint where conname = 'competency_results_score_only_when_scored'),
         'competency_results_score_only_when_scored'
) c
order by ok, check_name;
