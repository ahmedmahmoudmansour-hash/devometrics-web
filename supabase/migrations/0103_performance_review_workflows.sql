-- 0103: Configurable Impact Cycle workflows + generic custom steps
--
-- Per the 2026-08-03 strategic memo's "Smart Performance Module" item: lets
-- an org admin reorder/rename/include-or-exclude the review's sections
-- instead of the fixed self-assessment -> goals -> competency ratings ->
-- manager's perspective -> conclusion sequence baked into the UI today, plus
-- insert arbitrary named custom steps (Peer Feedback, HR Review, Executive
-- Approval, etc.) via one generic mechanism rather than a new table per kind.
--
-- ADDITIVE, NOT A TABLE SWAP: performance_reviews stays the surviving
-- envelope row (it's load-bearing outside this feature — listMyPendingActions
-- and due_performance_review_reminders() both filter it directly) and the
-- five existing content tables (self_assessments, manager_assessments,
-- goals, competency_ratings, upline_signoffs) are untouched and keep holding
-- exactly the content they always have. What's new is purely a
-- sequencing/config layer on top: workflow_templates/_steps (what an admin
-- authors) and instance_steps (a per-review SNAPSHOT of a template's steps
-- at instantiation time — never a live reference, so editing a template
-- later never retroactively changes an in-progress review, same rule
-- already used for onboarding in 0102).
--
-- Every review — including ones mid-cycle right now — gets real instance
-- steps backfilled in Part 3 below; that's what satisfies "migrate
-- everything," not a physical relocation of content.
--
-- Fixes a confirmed real bug while here: submitManagerAssessment
-- (lib/performanceReviews/actions.ts) did a plain client .update() on
-- performance_review_manager_assessments.development_needs, but that table
-- has only ever had SELECT policies (0076/0078/0082) — no INSERT/UPDATE
-- policy for anyone. The update silently no-op'd every time. Fixed by moving
-- development_needs into submit_manager_assessment's own SECURITY DEFINER
-- upsert below. Going forward: no table holding review-instance content may
-- have a client-writable RLS policy — every write is RPC-mediated, which is
-- also why performance_review_instance_steps and the two new custom-step
-- tables below get zero INSERT/UPDATE policies of their own.

-- ============================================================
-- Part 1: Core-5 workflow schema (templates, steps, instance steps)
-- ============================================================

create table if not exists public.performance_review_workflow_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'My Workflow',
  -- Exactly one default template per org is what auto-instantiation looks
  -- for (same convention as onboarding_templates in 0102); other named
  -- templates can coexist (e.g. cloned from the starter library in Part 4,
  -- or a future per-department template) without a schema change.
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_review_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.performance_review_workflow_templates(id) on delete cascade,
  position integer not null default 0,
  step_type text not null check (
    step_type in ('self_assessment', 'goals', 'competency_ratings', 'manager_assessment', 'conclusion', 'custom')
  ),
  title text not null,
  description text,
  -- Step-type-specific config, validated in TypeScript rather than a rigid
  -- column set (the 5 core types need very different shapes; see
  -- lib/performanceReviews/workflowTypes.ts). Always '{}' for step types
  -- with no config today. Reserves a `visibility_condition` key (always
  -- null in v1) as the future hook for conditional steps — the natural
  -- place to evaluate it later is exactly where steps already get
  -- snapshotted (ensure_reviews_for_cycle below), so no schema change will
  -- be needed to add that later.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_review_instance_steps (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  -- Lineage only, never live-read for rendering — same posture as
  -- onboarding_instance_steps.template_step_id.
  workflow_step_id uuid references public.performance_review_workflow_steps(id) on delete set null,
  position integer not null default 0,
  step_type text not null check (
    step_type in ('self_assessment', 'goals', 'competency_ratings', 'manager_assessment', 'conclusion', 'custom')
  ),
  title text not null,
  description text,
  data jsonb not null default '{}'::jsonb,
  -- Stamped by the relevant RPC when that step's underlying content is
  -- submitted. Stays permanently null for goals/competency_ratings (list-type
  -- steps with no single "submit" moment — matches today's actual behavior).
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.performance_review_workflow_templates enable row level security;
alter table public.performance_review_workflow_steps enable row level security;
alter table public.performance_review_instance_steps enable row level security;

alter table public.performance_review_cycles
  add column if not exists workflow_template_id uuid references public.performance_review_workflow_templates(id) on delete set null;

-- Widen performance_review_competency_ratings so a rating can key off either
-- the platform's fixed dimension text (today's only behavior, unchanged) OR
-- one of the org's own organization_competencies entries (0035/0042) — never
-- a second scoring system, just letting a custom, optionally-dimension-
-- mapped competency sit in the same rating list.
do $$
declare
  v_pk_name text;
  v_pk_is_on_id boolean;
begin
  select tc.constraint_name,
         (select bool_and(kcu.column_name = 'id')
          from information_schema.key_column_usage kcu
          where kcu.constraint_name = tc.constraint_name and kcu.table_schema = 'public')
    into v_pk_name, v_pk_is_on_id
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'
    and tc.table_name = 'performance_review_competency_ratings'
    and tc.constraint_type = 'PRIMARY KEY';

  if v_pk_name is not null and not coalesce(v_pk_is_on_id, false) then
    execute format('alter table public.performance_review_competency_ratings drop constraint %I', v_pk_name);
  end if;
end $$;

alter table public.performance_review_competency_ratings
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'performance_review_competency_ratings'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.performance_review_competency_ratings add primary key (id);
  end if;
end $$;

alter table public.performance_review_competency_ratings
  add column if not exists organization_competency_id uuid references public.organization_competencies(id) on delete set null;

alter table public.performance_review_competency_ratings
  alter column dimension drop not null;

-- Two independent uniqueness rules instead of the old composite PK — a
-- dimension-only rating and an org-competency rating are different keys
-- entirely, so a coalesce-based single index would be wrong (it would let a
-- rating on unmapped dimension=null org-competency A collide with unmapped
-- org-competency B). Existing rows are all dimension-only with
-- organization_competency_id null, so they slot into the first index with
-- no data rewrite needed.
create unique index if not exists performance_review_competency_ratings_dimension_key
  on public.performance_review_competency_ratings (review_id, dimension)
  where organization_competency_id is null;

create unique index if not exists performance_review_competency_ratings_org_competency_key
  on public.performance_review_competency_ratings (review_id, organization_competency_id)
  where organization_competency_id is not null;

-- ============================================================
-- Part 2: Core-5 RLS + RPCs
-- ============================================================

-- Templates/steps: non-sensitive authoring config, same admin-ALL /
-- member-SELECT split as onboarding_templates (0102).
drop policy if exists "Org admins can manage review workflow templates" on public.performance_review_workflow_templates;
create policy "Org admins can manage review workflow templates"
  on public.performance_review_workflow_templates for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view review workflow templates" on public.performance_review_workflow_templates;
create policy "Org members can view review workflow templates"
  on public.performance_review_workflow_templates for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins can manage review workflow steps" on public.performance_review_workflow_steps;
create policy "Org admins can manage review workflow steps"
  on public.performance_review_workflow_steps for all
  using (exists (
    select 1 from public.performance_review_workflow_templates t
    where t.id = performance_review_workflow_steps.template_id and public.is_org_admin(t.organization_id)
  ))
  with check (exists (
    select 1 from public.performance_review_workflow_templates t
    where t.id = performance_review_workflow_steps.template_id and public.is_org_admin(t.organization_id)
  ));

drop policy if exists "Org members can view review workflow steps" on public.performance_review_workflow_steps;
create policy "Org members can view review workflow steps"
  on public.performance_review_workflow_steps for select
  using (exists (
    select 1 from public.performance_review_workflow_templates t
    where t.id = performance_review_workflow_steps.template_id and public.is_org_member(t.organization_id)
  ));

-- Instance steps: review-instance CONTENT (not authoring config) — the
-- standard 4-viewer-class SELECT pattern used everywhere else on this
-- feature, and deliberately NO insert/update policy for anyone. Writes only
-- happen inside the RPCs below.
drop policy if exists "Employees can view their own review steps" on public.performance_review_instance_steps;
create policy "Employees can view their own review steps"
  on public.performance_review_instance_steps for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_instance_steps.review_id and r.employee_user_id = auth.uid()
  ));

drop policy if exists "Admins view review steps in their org" on public.performance_review_instance_steps;
create policy "Admins view review steps in their org"
  on public.performance_review_instance_steps for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_instance_steps.review_id and public.is_org_admin(r.organization_id)
  ));

drop policy if exists "Managers view direct reports' review steps" on public.performance_review_instance_steps;
create policy "Managers view direct reports' review steps"
  on public.performance_review_instance_steps for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_instance_steps.review_id and public.is_manager_of_user(r.employee_user_id)
  ));

drop policy if exists "Upline managers view review steps in their chain" on public.performance_review_instance_steps;
create policy "Upline managers view review steps in their chain"
  on public.performance_review_instance_steps for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_instance_steps.review_id and public.is_upline_manager_of_user(r.employee_user_id)
  ));

-- ensure_reviews_for_cycle: extended (same signature) to also resolve the
-- cycle's workflow template (or the org's default) and snapshot its steps
-- into instance_steps for any review that doesn't have any yet — covers
-- both freshly-seeded reviews and new joiners backfilled on a later call.
-- Also auto-resolves role-based custom-step assignees for those reviews.
create or replace function public.ensure_reviews_for_cycle(target_cycle_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_count integer;
  v_template_id uuid;
  v_review_id uuid;
begin
  select organization_id into v_org_id from public.performance_review_cycles where id = target_cycle_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_reviews (cycle_id, organization_id, employee_user_id)
  select target_cycle_id, v_org_id, m.user_id
  from public.organization_members m
  where m.organization_id = v_org_id
  on conflict (cycle_id, employee_user_id) do nothing;

  get diagnostics v_count = row_count;

  select workflow_template_id into v_template_id
  from public.performance_review_cycles where id = target_cycle_id;

  if v_template_id is null then
    select id into v_template_id
    from public.performance_review_workflow_templates
    where organization_id = v_org_id and is_default = true
    limit 1;
  end if;

  if v_template_id is not null then
    for v_review_id in
      select r.id from public.performance_reviews r
      where r.cycle_id = target_cycle_id
        and not exists (select 1 from public.performance_review_instance_steps s where s.review_id = r.id)
    loop
      insert into public.performance_review_instance_steps (review_id, workflow_step_id, position, step_type, title, description, data)
      select v_review_id, ws.id, ws.position, ws.step_type, ws.title, ws.description, ws.data
      from public.performance_review_workflow_steps ws
      where ws.template_id = v_template_id
      order by ws.position;

      perform public.resolve_custom_step_role_assignments(v_review_id);
    end loop;
  end if;

  return v_count;
end;
$$;

revoke all on function public.ensure_reviews_for_cycle(uuid) from public;
grant execute on function public.ensure_reviews_for_cycle(uuid) to authenticated;

create or replace function public.submit_self_assessment(target_review_id uuid, p_rating integer, p_reflection text)
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

  insert into public.performance_review_self_assessments (review_id, rating, reflection, submitted_at)
  values (target_review_id, p_rating, p_reflection, now())
  on conflict (review_id) do update
    set rating = excluded.rating, reflection = excluded.reflection, submitted_at = now(), updated_at = now();

  update public.performance_reviews
    set status = 'self_submitted'
    where id = target_review_id and status = 'not_started';

  update public.performance_review_instance_steps
    set submitted_at = now()
    where review_id = target_review_id and step_type = 'self_assessment';
end;
$$;

revoke all on function public.submit_self_assessment(uuid, integer, text) from public;
grant execute on function public.submit_self_assessment(uuid, integer, text) to authenticated;

-- submit_manager_assessment: gains p_development_needs (appended, defaulted
-- — safe via create or replace, existing call sites keep working). This is
-- the fix for the confirmed bug: development_needs now persists inside this
-- SECURITY DEFINER upsert instead of a plain client .update() that had no
-- matching RLS policy and silently no-op'd every time.
create or replace function public.submit_manager_assessment(
  target_review_id uuid,
  p_rating integer,
  p_feedback text,
  p_development_needs text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  insert into public.performance_review_manager_assessments (review_id, reviewer_user_id, rating, feedback, development_needs, submitted_at)
  values (target_review_id, auth.uid(), p_rating, p_feedback, p_development_needs, now())
  on conflict (review_id) do update
    set reviewer_user_id = auth.uid(), rating = excluded.rating, feedback = excluded.feedback,
        development_needs = excluded.development_needs, submitted_at = now(), updated_at = now();

  update public.performance_reviews set status = 'manager_submitted' where id = target_review_id;

  update public.organization_members
    set performance_rating = p_rating,
        performance_rating_note = p_feedback,
        performance_rating_updated_at = now()
    where organization_id = v_org_id and user_id = v_employee;

  update public.performance_review_instance_steps
    set submitted_at = now()
    where review_id = target_review_id and step_type = 'manager_assessment';
end;
$$;

revoke all on function public.submit_manager_assessment(uuid, integer, text, text) from public;
grant execute on function public.submit_manager_assessment(uuid, integer, text, text) to authenticated;

-- close_review: the "must have a submitted Manager's Perspective" gate
-- becomes step-set-aware — only enforced if this review's own step list
-- actually includes a manager_assessment step (a configured template could
-- legitimately omit it). Falls back to requiring it if the review somehow
-- has zero instance steps at all (shouldn't happen once this migration's
-- backfill has run, but matches the original, safer behavior if it did).
create or replace function public.close_review(target_review_id uuid, p_conclusion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_has_any_steps boolean;
  v_requires_manager_assessment boolean;
  v_has_manager_assessment boolean;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  select exists (
    select 1 from public.performance_review_instance_steps where review_id = target_review_id
  ) into v_has_any_steps;

  if not v_has_any_steps then
    v_requires_manager_assessment := true;
  else
    select exists (
      select 1 from public.performance_review_instance_steps
      where review_id = target_review_id and step_type = 'manager_assessment'
    ) into v_requires_manager_assessment;
  end if;

  if v_requires_manager_assessment then
    select exists (
      select 1 from public.performance_review_manager_assessments
      where review_id = target_review_id and submitted_at is not null
    ) into v_has_manager_assessment;
    if not v_has_manager_assessment then
      raise exception 'Submit the Manager''s Perspective before closing the cycle';
    end if;
  end if;

  update public.performance_reviews
    set conclusion = p_conclusion, manager_closed_at = now(), manager_closed_by = auth.uid(), status = 'closed'
    where id = target_review_id;

  update public.performance_review_instance_steps
    set submitted_at = now()
    where review_id = target_review_id and step_type = 'conclusion';
end;
$$;

revoke all on function public.close_review(uuid, text) from public;
grant execute on function public.close_review(uuid, text) to authenticated;

-- set_competency_rating: gains p_organization_competency_id (appended,
-- defaulted). When supplied, validates it belongs to the review's own org
-- and copies its mapped_dimension into the dimension column at rating time
-- (so a mapped custom competency still feeds Gap Analysis/Skill
-- Radar/Career Health Score exactly like a fixed-dimension rating; an
-- unmapped one is stored but never touches cross-platform scoring — same
-- posture organization_competencies already has everywhere else).
create or replace function public.set_competency_rating(
  target_review_id uuid,
  p_dimension text,
  p_rating integer,
  p_note text,
  p_organization_competency_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_mapped_dimension text;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  if p_organization_competency_id is not null then
    select mapped_dimension into v_mapped_dimension
    from public.organization_competencies
    where id = p_organization_competency_id and organization_id = v_org_id;
    if not found then
      raise exception 'Invalid competency';
    end if;

    insert into public.performance_review_competency_ratings (review_id, organization_competency_id, dimension, rating, note)
    values (target_review_id, p_organization_competency_id, v_mapped_dimension, p_rating, p_note)
    on conflict (review_id, organization_competency_id) where organization_competency_id is not null
    do update set rating = excluded.rating, note = excluded.note, dimension = excluded.dimension;
  else
    insert into public.performance_review_competency_ratings (review_id, dimension, rating, note)
    values (target_review_id, p_dimension, p_rating, p_note)
    on conflict (review_id, dimension) where organization_competency_id is null
    do update set rating = excluded.rating, note = excluded.note;
  end if;
end;
$$;

revoke all on function public.set_competency_rating(uuid, text, integer, text, uuid) from public;
grant execute on function public.set_competency_rating(uuid, text, integer, text, uuid) to authenticated;

-- ============================================================
-- Part 3: Full-data backfill ("migrate everything") — purely additive,
-- never touches a row in the five existing content tables.
-- ============================================================

-- 3a. One default template per org that has ever had a cycle.
insert into public.performance_review_workflow_templates (organization_id, name, is_default)
select distinct c.organization_id, 'Standard Impact Cycle', true
from public.performance_review_cycles c
where not exists (
  select 1 from public.performance_review_workflow_templates t
  where t.organization_id = c.organization_id and t.is_default = true
);

-- 3b. Five standard steps on any default template that doesn't have steps
-- yet, in today's actual fixed order and labeling. The competency step's
-- empty arrays are the "all 8 fixed dimensions" sentinel — this makes the
-- migrated default identical to today's only behavior.
insert into public.performance_review_workflow_steps (template_id, position, step_type, title, description, data)
select t.id, v.position, v.step_type, v.title, v.description, v.data
from public.performance_review_workflow_templates t
cross join (
  values
    (0, 'self_assessment', 'Self-Reflection', null::text, '{}'::jsonb),
    (1, 'goals', 'Focus Areas', null::text, '{}'::jsonb),
    (2, 'competency_ratings', 'Competency Ratings', null::text, '{"fixed_dimensions": [], "organization_competency_ids": []}'::jsonb),
    (3, 'manager_assessment', 'Manager''s Perspective', null::text, '{}'::jsonb),
    (4, 'conclusion', 'Conclusion', null::text, '{}'::jsonb)
) as v(position, step_type, title, description, data)
where t.is_default = true
  and not exists (
    select 1 from public.performance_review_workflow_steps ws where ws.template_id = t.id
  );

-- 3c. Backfill workflow_template_id on existing cycles.
update public.performance_review_cycles c
set workflow_template_id = t.id
from public.performance_review_workflow_templates t
where c.workflow_template_id is null
  and t.organization_id = c.organization_id
  and t.is_default = true;

-- 3d. Backfill instance_steps for every existing review with none yet.
-- submitted_at is populated from the matching existing table where
-- applicable so an in-flight review (e.g. self_submitted but not yet
-- manager_submitted) shows the correct per-step state immediately — nothing
-- about its actual content changes, and the five source tables are never
-- written to by this block.
insert into public.performance_review_instance_steps (review_id, workflow_step_id, position, step_type, title, description, data, submitted_at)
select
  r.id,
  ws.id,
  ws.position,
  ws.step_type,
  ws.title,
  ws.description,
  ws.data,
  case ws.step_type
    when 'self_assessment' then sa.submitted_at
    when 'manager_assessment' then ma.submitted_at
    when 'conclusion' then r.manager_closed_at
    else null
  end
from public.performance_reviews r
join public.performance_review_cycles c on c.id = r.cycle_id
join public.performance_review_workflow_templates t on t.id = c.workflow_template_id
join public.performance_review_workflow_steps ws on ws.template_id = t.id
left join public.performance_review_self_assessments sa on sa.review_id = r.id
left join public.performance_review_manager_assessments ma on ma.review_id = r.id
where not exists (
  select 1 from public.performance_review_instance_steps s where s.review_id = r.id
);

-- Old tables (self_assessments, manager_assessments, goals,
-- competency_ratings, upline_signoffs): kept permanently. They are the
-- content store for the core-5 steps, not a deprecated shadow of anything —
-- there's nothing to drop.

-- ============================================================
-- Part 4: Generic custom-step framework
-- ============================================================

-- Holds who's assigned to respond to a custom instance step. Separate from
-- responses because assignment and response happen at different times by
-- different actors: role-based assignees (direct manager, org admin, an
-- upline level) resolve automatically the moment a review is snapshotted
-- (resolve_custom_step_role_assignments above); manual assignees (specific
-- peers, a named executive, a country lead) are picked LATER by the
-- employee's manager or an admin, since at bulk cycle-creation time nobody
-- has looked at any individual employee yet. "0 of N assigned" is a normal
-- state for manual-mode steps, not an error.
create table if not exists public.performance_review_custom_step_assignments (
  id uuid primary key default gen_random_uuid(),
  instance_step_id uuid not null references public.performance_review_instance_steps(id) on delete cascade,
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  assignee_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (instance_step_id, assignee_user_id)
);

-- Holds every response to every custom step, regardless of custom_kind — one
-- generic table, not one per kind. The same unique constraint naturally
-- makes a single-decision-maker step end up with exactly one row and a
-- multi-respondent step end up with N independent rows — same shape as the
-- existing performance_review_upline_signoffs precedent (0082).
create table if not exists public.performance_review_custom_step_responses (
  id uuid primary key default gen_random_uuid(),
  instance_step_id uuid not null references public.performance_review_instance_steps(id) on delete cascade,
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  responder_user_id uuid not null references auth.users(id) on delete cascade,
  -- Shape depends on the step's data->>'response_shape':
  --   approval -> {"decision": "approve"|"reject", "comment": text}
  --   rating   -> {"rating": 1-5, "comment": text}
  --   text     -> {"text": string}
  -- Validated server-side inside submit_custom_step_response below — the
  -- real boundary, not just TypeScript-side validation.
  response jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_step_id, responder_user_id)
);

alter table public.performance_review_custom_step_assignments enable row level security;
alter table public.performance_review_custom_step_responses enable row level security;

drop policy if exists "Employees can view their own review's custom step assignments" on public.performance_review_custom_step_assignments;
create policy "Employees can view their own review's custom step assignments"
  on public.performance_review_custom_step_assignments for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_custom_step_assignments.review_id and r.employee_user_id = auth.uid()
  ));

drop policy if exists "Assignees can view their own assignment rows" on public.performance_review_custom_step_assignments;
create policy "Assignees can view their own assignment rows"
  on public.performance_review_custom_step_assignments for select
  using (assignee_user_id = auth.uid());

drop policy if exists "Admins view custom step assignments in their org" on public.performance_review_custom_step_assignments;
create policy "Admins view custom step assignments in their org"
  on public.performance_review_custom_step_assignments for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_custom_step_assignments.review_id and public.is_org_admin(r.organization_id)
  ));

drop policy if exists "Managers view custom step assignments in their chain" on public.performance_review_custom_step_assignments;
create policy "Managers view custom step assignments in their chain"
  on public.performance_review_custom_step_assignments for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_custom_step_assignments.review_id
      and (public.is_manager_of_user(r.employee_user_id) or public.is_upline_manager_of_user(r.employee_user_id))
  ));

-- Responses: same viewer classes, plus the reviewed employee's own view is
-- narrower — anonymous peer/360 feedback is withheld from them at the RLS
-- layer (not just hidden in the UI); leadership-authored custom steps
-- (HR Review, Executive Approval, etc.) stay fully attributed to them, same
-- as every other step type. Managers/admins are never subject to this
-- carve-out — the anonymity is specifically "hidden from the person being
-- reviewed," not "hidden from leadership."
drop policy if exists "Responders can view their own submitted response" on public.performance_review_custom_step_responses;
create policy "Responders can view their own submitted response"
  on public.performance_review_custom_step_responses for select
  using (responder_user_id = auth.uid());

drop policy if exists "Employees can view non-anonymous custom step responses on their own review" on public.performance_review_custom_step_responses;
create policy "Employees can view non-anonymous custom step responses on their own review"
  on public.performance_review_custom_step_responses for select
  using (exists (
    select 1 from public.performance_reviews r
    join public.performance_review_instance_steps s on s.id = performance_review_custom_step_responses.instance_step_id
    where r.id = performance_review_custom_step_responses.review_id
      and r.employee_user_id = auth.uid()
      and not (
        coalesce(s.data->>'custom_kind', '') in ('peer_feedback', '360_feedback')
        and coalesce((s.data->>'anonymize_to_employee')::boolean, true)
      )
  ));

drop policy if exists "Admins view custom step responses in their org" on public.performance_review_custom_step_responses;
create policy "Admins view custom step responses in their org"
  on public.performance_review_custom_step_responses for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_custom_step_responses.review_id and public.is_org_admin(r.organization_id)
  ));

drop policy if exists "Direct managers view custom step responses in their chain" on public.performance_review_custom_step_responses;
create policy "Direct managers view custom step responses in their chain"
  on public.performance_review_custom_step_responses for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_custom_step_responses.review_id and public.is_manager_of_user(r.employee_user_id)
  ));

drop policy if exists "Upline managers view custom step responses in their chain" on public.performance_review_custom_step_responses;
create policy "Upline managers view custom step responses in their chain"
  on public.performance_review_custom_step_responses for select
  using (exists (
    select 1 from public.performance_reviews r
    where r.id = performance_review_custom_step_responses.review_id and public.is_upline_manager_of_user(r.employee_user_id)
  ));

-- Auto-resolves role-based custom-step assignees (direct_manager, org_admin,
-- upline_manager_level_N) for every custom step on a review that's
-- configured with assignment.mode = 'role'. Called from
-- ensure_reviews_for_cycle right after a review's steps are snapshotted, and
-- safe to call again later (on conflict do nothing). Manual-mode steps are
-- deliberately left with zero assignment rows here — see the table comment
-- above.
create or replace function public.resolve_custom_step_role_assignments(target_review_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_step record;
  v_role text;
  v_assignee uuid;
  v_level integer;
  v_current uuid;
  v_hop integer;
  v_count integer := 0;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  for v_step in
    select id, data from public.performance_review_instance_steps
    where review_id = target_review_id and step_type = 'custom'
      and coalesce(data->'assignment'->>'mode', '') = 'role'
  loop
    v_role := v_step.data->'assignment'->>'role';
    v_assignee := null;

    if v_role = 'direct_manager' then
      select manager_user_id into v_assignee
      from public.organization_members
      where user_id = v_employee and organization_id = v_org_id
      limit 1;
    elsif v_role = 'org_admin' then
      select user_id into v_assignee
      from public.organization_members
      where organization_id = v_org_id and role = 'admin'
      limit 1;
    elsif v_role like 'upline_manager_level_%' then
      v_level := nullif(regexp_replace(v_role, 'upline_manager_level_', ''), '')::integer;
      v_current := v_employee;
      v_hop := 0;
      while v_current is not null and v_hop < coalesce(v_level, 0) loop
        select manager_user_id into v_current
        from public.organization_members
        where user_id = v_current and organization_id = v_org_id
        limit 1;
        v_hop := v_hop + 1;
      end loop;
      v_assignee := v_current;
    end if;

    if v_assignee is not null then
      insert into public.performance_review_custom_step_assignments (instance_step_id, review_id, assignee_user_id, assigned_by)
      values (v_step.id, target_review_id, v_assignee, null)
      on conflict (instance_step_id, assignee_user_id) do nothing;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.resolve_custom_step_role_assignments(uuid) from public;
grant execute on function public.resolve_custom_step_role_assignments(uuid) to authenticated;

-- Manual-mode assignment: caller must be the review's own direct manager or
-- an org admin. Validates the assignee is in the same org (no cross-org
-- assignment). Single-respondent steps replace any prior assignee;
-- multi-respondent steps add up to data->>'max_respondents' if set.
create or replace function public.assign_custom_step_responder(target_instance_step_id uuid, p_assignee_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review_id uuid;
  v_org_id uuid;
  v_employee uuid;
  v_data jsonb;
  v_multi boolean;
  v_max integer;
  v_current_count integer;
  v_assignee_in_org boolean;
begin
  select s.review_id, s.data into v_review_id, v_data
  from public.performance_review_instance_steps s
  where s.id = target_instance_step_id and s.step_type = 'custom';
  if v_review_id is null then
    raise exception 'Step not found';
  end if;

  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = v_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  select exists (
    select 1 from public.organization_members
    where user_id = p_assignee_user_id and organization_id = v_org_id
  ) into v_assignee_in_org;
  if not v_assignee_in_org then
    raise exception 'Assignee must be a member of the same organization';
  end if;

  v_multi := coalesce((v_data->>'multi_respondent')::boolean, false);
  v_max := nullif(v_data->>'max_respondents', '')::integer;

  if not v_multi then
    delete from public.performance_review_custom_step_assignments
    where instance_step_id = target_instance_step_id and assignee_user_id <> p_assignee_user_id;
  else
    select count(*) into v_current_count
    from public.performance_review_custom_step_assignments
    where instance_step_id = target_instance_step_id;
    if v_max is not null and v_current_count >= v_max then
      raise exception 'This step already has its maximum number of assigned responders';
    end if;
  end if;

  insert into public.performance_review_custom_step_assignments (instance_step_id, review_id, assignee_user_id, assigned_by)
  values (target_instance_step_id, v_review_id, p_assignee_user_id, auth.uid())
  on conflict (instance_step_id, assignee_user_id) do nothing;
end;
$$;

revoke all on function public.assign_custom_step_responder(uuid, uuid) from public;
grant execute on function public.assign_custom_step_responder(uuid, uuid) to authenticated;

-- Removing someone's future turn never deletes feedback they already gave —
-- only a not-yet-submitted response row is cleared alongside the assignment.
create or replace function public.unassign_custom_step_responder(target_instance_step_id uuid, p_assignee_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review_id uuid;
  v_org_id uuid;
  v_employee uuid;
begin
  select review_id into v_review_id
  from public.performance_review_instance_steps
  where id = target_instance_step_id and step_type = 'custom';
  if v_review_id is null then
    raise exception 'Step not found';
  end if;

  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = v_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  delete from public.performance_review_custom_step_assignments
  where instance_step_id = target_instance_step_id and assignee_user_id = p_assignee_user_id;

  delete from public.performance_review_custom_step_responses
  where instance_step_id = target_instance_step_id and responder_user_id = p_assignee_user_id and submitted_at is null;
end;
$$;

revoke all on function public.unassign_custom_step_responder(uuid, uuid) from public;
grant execute on function public.unassign_custom_step_responder(uuid, uuid) to authenticated;

-- The actual write. Authorization: caller must already be an assigned
-- responder for this step (closes the exact gap a plain client .update()
-- would leave open). Validates the response server-side against the step's
-- configured response_shape — the real boundary, not just TypeScript-side
-- validation before the call.
create or replace function public.submit_custom_step_response(target_instance_step_id uuid, p_response jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review_id uuid;
  v_shape text;
  v_is_assigned boolean;
  v_decision text;
  v_rating integer;
  v_text text;
begin
  select review_id, data->>'response_shape' into v_review_id, v_shape
  from public.performance_review_instance_steps
  where id = target_instance_step_id and step_type = 'custom';
  if v_review_id is null then
    raise exception 'Step not found';
  end if;

  select exists (
    select 1 from public.performance_review_custom_step_assignments
    where instance_step_id = target_instance_step_id and assignee_user_id = auth.uid()
  ) into v_is_assigned;
  if not v_is_assigned then
    raise exception 'Not authorized';
  end if;

  if v_shape = 'approval' then
    v_decision := p_response->>'decision';
    if v_decision not in ('approve', 'reject') then
      raise exception 'Invalid response';
    end if;
    if length(coalesce(p_response->>'comment', '')) > 5000 then
      raise exception 'Comment is too long';
    end if;
  elsif v_shape = 'rating' then
    v_rating := nullif(p_response->>'rating', '')::integer;
    if v_rating is null or v_rating < 1 or v_rating > 5 then
      raise exception 'Invalid response';
    end if;
    if length(coalesce(p_response->>'comment', '')) > 5000 then
      raise exception 'Comment is too long';
    end if;
  elsif v_shape = 'text' then
    v_text := p_response->>'text';
    if v_text is null or length(trim(v_text)) = 0 then
      raise exception 'Response text is required';
    end if;
    if length(v_text) > 5000 then
      raise exception 'Response is too long';
    end if;
  else
    raise exception 'Step is misconfigured';
  end if;

  insert into public.performance_review_custom_step_responses (instance_step_id, review_id, responder_user_id, response, submitted_at)
  values (target_instance_step_id, v_review_id, auth.uid(), p_response, now())
  on conflict (instance_step_id, responder_user_id) do update
    set response = excluded.response, submitted_at = now(), updated_at = now();
end;
$$;

revoke all on function public.submit_custom_step_response(uuid, jsonb) from public;
grant execute on function public.submit_custom_step_response(uuid, jsonb) to authenticated;

-- Read-only "2 of 3 submitted" helper — returns counts only, no content, so
-- it's left open to any authenticated caller (the step id itself is only
-- ever obtained through an already-RLS-scoped query).
create or replace function public.get_custom_step_completion(target_instance_step_id uuid)
returns table(assigned_count integer, submitted_count integer, min_required integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*)::integer from public.performance_review_custom_step_assignments where instance_step_id = target_instance_step_id),
    (select count(*)::integer from public.performance_review_custom_step_responses where instance_step_id = target_instance_step_id and submitted_at is not null),
    (select nullif(data->>'min_respondents', '')::integer from public.performance_review_instance_steps where id = target_instance_step_id);
$$;

revoke all on function public.get_custom_step_completion(uuid) from public;
grant execute on function public.get_custom_step_completion(uuid) to authenticated;

-- Anonymized aggregate path for the reviewed employee on peer/360 steps —
-- pools rating/decision/comment content across all submitted responses
-- WITHOUT ever exposing responder_user_id, and only once at least 3 (or the
-- step's own min_respondents, whichever is higher) have responded, so a lone
-- early respondent can't be de-anonymized by elimination. Callable only by
-- the review's own employee.
create or replace function public.get_custom_step_aggregate_for_employee(target_instance_step_id uuid)
returns table(
  ready boolean,
  submitted_count integer,
  threshold integer,
  response_shape text,
  avg_rating numeric,
  approve_count integer,
  reject_count integer,
  comments text[]
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_review_id uuid;
  v_employee uuid;
  v_shape text;
  v_min integer;
  v_submitted integer;
  v_threshold integer;
begin
  select review_id, data->>'response_shape', nullif(data->>'min_respondents', '')::integer
    into v_review_id, v_shape, v_min
  from public.performance_review_instance_steps
  where id = target_instance_step_id and step_type = 'custom';
  if v_review_id is null then
    raise exception 'Step not found';
  end if;

  select employee_user_id into v_employee from public.performance_reviews where id = v_review_id;
  if v_employee is null or v_employee <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select count(*) into v_submitted
  from public.performance_review_custom_step_responses
  where instance_step_id = target_instance_step_id and submitted_at is not null;

  v_threshold := greatest(3, coalesce(v_min, 0));

  if v_submitted < v_threshold then
    return query select false, v_submitted, v_threshold, v_shape, null::numeric, null::integer, null::integer, null::text[];
    return;
  end if;

  return query
  select
    true,
    v_submitted,
    v_threshold,
    v_shape,
    (select avg((response->>'rating')::numeric) from public.performance_review_custom_step_responses
      where instance_step_id = target_instance_step_id and submitted_at is not null),
    (select count(*)::integer from public.performance_review_custom_step_responses
      where instance_step_id = target_instance_step_id and submitted_at is not null and response->>'decision' = 'approve'),
    (select count(*)::integer from public.performance_review_custom_step_responses
      where instance_step_id = target_instance_step_id and submitted_at is not null and response->>'decision' = 'reject'),
    (select array_agg(coalesce(response->>'text', response->>'comment') order by submitted_at)
      from public.performance_review_custom_step_responses
      where instance_step_id = target_instance_step_id and submitted_at is not null
        and coalesce(response->>'text', response->>'comment', '') <> '');
end;
$$;

revoke all on function public.get_custom_step_aggregate_for_employee(uuid) from public;
grant execute on function public.get_custom_step_aggregate_for_employee(uuid) to authenticated;

-- ============================================================
-- Part 5: Indexes
-- ============================================================

create index if not exists performance_review_workflow_steps_template_idx on public.performance_review_workflow_steps (template_id, position);
create index if not exists performance_review_instance_steps_review_idx on public.performance_review_instance_steps (review_id, position);
create index if not exists performance_review_competency_ratings_org_competency_idx on public.performance_review_competency_ratings (organization_competency_id) where organization_competency_id is not null;
create index if not exists performance_review_custom_step_assignments_step_idx on public.performance_review_custom_step_assignments (instance_step_id);
create index if not exists performance_review_custom_step_assignments_review_idx on public.performance_review_custom_step_assignments (review_id);
create index if not exists performance_review_custom_step_assignments_assignee_idx on public.performance_review_custom_step_assignments (assignee_user_id);
create index if not exists performance_review_custom_step_responses_step_idx on public.performance_review_custom_step_responses (instance_step_id);
create index if not exists performance_review_custom_step_responses_review_idx on public.performance_review_custom_step_responses (review_id);
