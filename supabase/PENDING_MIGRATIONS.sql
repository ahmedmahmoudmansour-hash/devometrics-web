-- ============================================================
-- DEVOMETRICS -- FULL RE-RUN: MIGRATIONS 0102 THROUGH 0116
--
-- The onboarding page reported 0102 as never having been applied,
-- even though it was previously assumed/recorded as already run.
-- That assumption can no longer be trusted for anything in this
-- range, so this bundles every migration from 0102 through 0116
-- in one paste. Every statement in every one of these files is
-- idempotent (create table/policy/function if-not-exists or
-- or-replace patterns) -- re-running ones that already succeeded
-- is safe and will no-op on the parts that already exist.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run. If anything errors partway, copy the exact
-- error text back so it can be diagnosed rather than re-run blind.
-- ============================================================

-- ============================================================
-- 0102_onboarding_configurable.sql
-- ============================================================
-- 0102: Configurable onboarding — templates + per-employee instances
--
-- Replaces the single hardcoded 2-task onboarding automation
-- (runHireToOnboarding: "Complete your profile" + "Take your first
-- assessment") with a real, admin-configurable checklist, per the
-- 2026-08-03 strategic memo's "Onboarding Experience Review" item.
-- Deliberately simple rather than a full workflow engine (matches the
-- memo's own "simplicity over complexity" principle): three step types
-- (task, knowledge_hub, manager_approval), a flat ordered list, no
-- branching/conditionals.
--
-- Two-table pairs, same "template vs. snapshot instance" split already
-- used for performance review cycles elsewhere in this schema:
-- onboarding_templates/_steps are what an admin authors and can keep
-- editing; onboarding_instances/_instance_steps are what actually got
-- assigned to a real person at a point in time — instance_steps SNAPSHOTS
-- title/description/step_type/knowledge_hub_content_id rather than just
-- referencing the template step, so editing a template later never
-- silently changes what's already been assigned to someone mid-onboarding.

create table if not exists public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Default onboarding',
  -- Exactly one default template per org is what auto-instantiation looks
  -- for; multiple non-default templates could exist for future use
  -- (e.g. per-department checklists) without a schema change later.
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  position integer not null default 0,
  step_type text not null check (step_type in ('task', 'knowledge_hub', 'manager_approval')),
  title text not null,
  description text,
  -- Only meaningful when step_type = 'knowledge_hub' — lets an onboarding
  -- step point at a real Knowledge Hub document/policy instead of
  -- building a second, parallel "required reading" system from scratch.
  knowledge_hub_content_id uuid references public.knowledge_hub_content(id) on delete set null,
  due_offset_days integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.onboarding_templates(id) on delete set null,
  started_at timestamptz not null default now()
);

create table if not exists public.onboarding_instance_steps (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.onboarding_instances(id) on delete cascade,
  template_step_id uuid references public.onboarding_template_steps(id) on delete set null,
  position integer not null default 0,
  step_type text not null check (step_type in ('task', 'knowledge_hub', 'manager_approval')),
  title text not null,
  description text,
  knowledge_hub_content_id uuid references public.knowledge_hub_content(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null
);

alter table public.onboarding_templates enable row level security;
alter table public.onboarding_template_steps enable row level security;
alter table public.onboarding_instances enable row level security;
alter table public.onboarding_instance_steps enable row level security;

-- Templates: admins fully manage; any org member can read (the new
-- employee's OWN session is what instantiates their onboarding at
-- signup time — this app has no service-role key, so that read has to
-- go through the acting employee's own RLS-permitted access, same
-- reasoning as workflow_automation_settings' member-readable policy).
drop policy if exists "Org admins can manage onboarding templates" on public.onboarding_templates;
create policy "Org admins can manage onboarding templates"
  on public.onboarding_templates for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view onboarding templates" on public.onboarding_templates;
create policy "Org members can view onboarding templates"
  on public.onboarding_templates for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins can manage onboarding template steps" on public.onboarding_template_steps;
create policy "Org admins can manage onboarding template steps"
  on public.onboarding_template_steps for all
  using (exists (select 1 from public.onboarding_templates t where t.id = onboarding_template_steps.template_id and public.is_org_admin(t.organization_id)))
  with check (exists (select 1 from public.onboarding_templates t where t.id = onboarding_template_steps.template_id and public.is_org_admin(t.organization_id)));

drop policy if exists "Org members can view onboarding template steps" on public.onboarding_template_steps;
create policy "Org members can view onboarding template steps"
  on public.onboarding_template_steps for select
  using (exists (
    select 1 from public.onboarding_templates t
    where t.id = onboarding_template_steps.template_id and public.is_org_member(t.organization_id)
  ));

-- Instances: the new employee creates their OWN instance (self-scoped,
-- fires from inside their own signup/invite-consumption request); org
-- admins can read every instance in their org for oversight.
drop policy if exists "Employees can create their own onboarding instance" on public.onboarding_instances;
create policy "Employees can create their own onboarding instance"
  on public.onboarding_instances for insert
  with check (employee_user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "Employees can view their own onboarding instance" on public.onboarding_instances;
create policy "Employees can view their own onboarding instance"
  on public.onboarding_instances for select
  using (employee_user_id = auth.uid());

drop policy if exists "Org admins can view their org's onboarding instances" on public.onboarding_instances;
create policy "Org admins can view their org's onboarding instances"
  on public.onboarding_instances for select
  using (public.is_org_admin(organization_id));

-- Instance steps: the employee can create + view + complete their own
-- non-approval steps; a reporting-line manager can view + approve
-- 'manager_approval' steps for their own reports specifically (never
-- someone else's); org admins can view everything in their org.
drop policy if exists "Employees can create their own onboarding steps" on public.onboarding_instance_steps;
create policy "Employees can create their own onboarding steps"
  on public.onboarding_instance_steps for insert
  with check (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid()));

drop policy if exists "Employees can view their own onboarding steps" on public.onboarding_instance_steps;
create policy "Employees can view their own onboarding steps"
  on public.onboarding_instance_steps for select
  using (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid()));

drop policy if exists "Employees can complete their own non-approval steps" on public.onboarding_instance_steps;
create policy "Employees can complete their own non-approval steps"
  on public.onboarding_instance_steps for update
  using (
    step_type <> 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid())
  )
  with check (
    step_type <> 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid())
  );

drop policy if exists "Managers can view their reports' onboarding steps" on public.onboarding_instance_steps;
create policy "Managers can view their reports' onboarding steps"
  on public.onboarding_instance_steps for select
  using (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_manager_of_user(i.employee_user_id)));

drop policy if exists "Managers can approve their reports' approval steps" on public.onboarding_instance_steps;
create policy "Managers can approve their reports' approval steps"
  on public.onboarding_instance_steps for update
  using (
    step_type = 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_manager_of_user(i.employee_user_id))
  )
  with check (
    step_type = 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_manager_of_user(i.employee_user_id))
  );

drop policy if exists "Org admins can view their org's onboarding steps" on public.onboarding_instance_steps;
create policy "Org admins can view their org's onboarding steps"
  on public.onboarding_instance_steps for select
  using (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_org_admin(i.organization_id)));

create index if not exists onboarding_template_steps_template_idx on public.onboarding_template_steps (template_id, position);
create index if not exists onboarding_instances_employee_idx on public.onboarding_instances (employee_user_id);
create index if not exists onboarding_instance_steps_instance_idx on public.onboarding_instance_steps (instance_id, position);

-- ============================================================
-- 0103_performance_review_workflows.sql
-- ============================================================
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

-- ============================================================
-- 0104_harden_custom_step_security.sql
-- ============================================================
-- 0104: Harden two gaps found in a security review of 0103's custom-step
-- framework, run right after 0103 went live.
--
-- 1. get_custom_step_completion(uuid) had NO authorization check at all —
--    any authenticated user could call it with any instance_step_id and
--    read back assignment/submission counts for a custom step on ANY
--    review in ANY organization, not just their own. Every other function
--    in 0103 checks is_org_admin/is_manager_of_user/employee ownership
--    first; this one was written as "just counts, no content, low risk"
--    and the auth check was skipped — a real cross-tenant metadata leak,
--    even though the practical exploitability is low (instance_step_id is
--    a random uuid, not enumerable). Fixed by adding the same authorization
--    check as the rest of the file, extended to also allow the step's own
--    assigned responder (who needs to see "2 of 3 submitted" on a step
--    they're actively responding to, same as the UI already assumes).
--    Rewritten from `language sql` to `language plpgsql` since the check
--    needs a conditional. An unauthorized call now returns zero rows
--    (not an exception) — matches the app's existing
--    `.maybeSingle()` -> null degrade pattern exactly.
--
-- 2. The RLS policy "Employees can view non-anonymous custom step responses
--    on their own review" did `(s.data->>'anonymize_to_employee')::boolean`
--    inline — a cast that THROWS on any non-boolean value. Per this same
--    codebase's own hardening lesson (0083's upline_level_of_user incident,
--    which broke every org's Impact Cycles roster in production because a
--    throwing expression inside an RLS USING clause aborts the ENTIRE
--    query, not just the one row), this is the exact same anti-pattern:
--    performance_review_workflow_steps.data is directly admin-writable
--    (not RPC-validated, unlike instance-step content), so a future admin
--    UI bug, a manual SQL edit, or a new feature that writes this field
--    slightly differently could silently blackout an employee's entire
--    custom-step response list with no error surfaced. Fixed by replacing
--    the cast with a plain text comparison that can never throw — only the
--    literal string 'false' turns anonymization off; anything else
--    (including malformed garbage) fails closed toward MORE privacy, which
--    is the correct default direction for this specific field.

create or replace function public.get_custom_step_completion(target_instance_step_id uuid)
returns table(assigned_count integer, submitted_count integer, min_required integer)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_review_id uuid;
  v_org_id uuid;
  v_employee uuid;
  v_authorized boolean;
begin
  select s.review_id into v_review_id
  from public.performance_review_instance_steps s
  where s.id = target_instance_step_id;
  if v_review_id is null then
    return;
  end if;

  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = v_review_id;
  if v_org_id is null then
    return;
  end if;

  v_authorized :=
    v_employee = auth.uid()
    or public.is_org_admin(v_org_id)
    or public.is_manager_of_user(v_employee)
    or public.is_upline_manager_of_user(v_employee)
    or exists (
      select 1 from public.performance_review_custom_step_assignments a
      where a.instance_step_id = target_instance_step_id and a.assignee_user_id = auth.uid()
    );
  if not v_authorized then
    return;
  end if;

  return query
  select
    (select count(*)::integer from public.performance_review_custom_step_assignments where instance_step_id = target_instance_step_id),
    (select count(*)::integer from public.performance_review_custom_step_responses where instance_step_id = target_instance_step_id and submitted_at is not null),
    (select nullif(data->>'min_respondents', '')::integer from public.performance_review_instance_steps where id = target_instance_step_id);
end;
$$;

revoke all on function public.get_custom_step_completion(uuid) from public;
grant execute on function public.get_custom_step_completion(uuid) to authenticated;

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
        and coalesce(s.data->>'anonymize_to_employee', 'true') <> 'false'
      )
  ));

-- ============================================================
-- 0105_org_chart_saved_views.sql
-- ============================================================
-- 0105: Org Chart saved views — Workstream 6 of the 2026-08-03 strategic
-- memo (the Org Chart rebuild: drag-and-drop reporting-line editing, card
-- field-visibility toggles/presets, country/business-unit/department
-- filtering, named saved views, print export).
--
-- This is the ONLY schema change the rebuild needs — everything else
-- (drag-and-drop reparenting, filtering, display toggles, depth-capping,
-- print export) is either reusing existing tables/RLS (organization_members,
-- setMemberManager, employee_role_change_history) unchanged, or is pure
-- client-side/UI state that is never persisted at all.
--
-- Same "org-wide, admin-authored, member-readable" visibility posture as
-- onboarding_templates (0102) and performance_review_workflow_templates
-- (0103) — no precedent anywhere in this schema for a private-per-admin
-- view, so this doesn't introduce one; a saved view any admin creates is
-- usable by every admin in the org.
--
-- Stores ONLY the toggle/density/depth-cap/filter/preset config as jsonb —
-- NEVER raw node x/y positions. The tidy-tree auto-layout algorithm
-- (lib/orgChart/tree.ts) always computes actual card positions at render
-- time from the live reporting-line data; nothing about layout geometry is
-- ever persisted here, so a saved view never goes stale relative to who
-- actually reports to whom.

create table if not exists public.org_chart_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Shape: { toggles: { showPhoto, showName, showTitle, showDepartment,
  -- showLocation, showTenure, showPerformanceBadge, showSuccessionStatus },
  -- density: 'comfortable'|'compact', maxDepth: number|null,
  -- filters: { countries: string[], businessUnits: string[], departments: string[] },
  -- presetKey: string|null }. Validated in TypeScript
  -- (lib/orgChart/cardConfig.ts), not in Postgres — same posture as every
  -- other config-shaped jsonb column added this project (workflow step
  -- data, custom-step response payloads).
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.org_chart_saved_views enable row level security;

drop policy if exists "Org admins can manage org chart saved views" on public.org_chart_saved_views;
create policy "Org admins can manage org chart saved views"
  on public.org_chart_saved_views for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart saved views" on public.org_chart_saved_views;
create policy "Org members can view org chart saved views"
  on public.org_chart_saved_views for select
  using (public.is_org_member(organization_id));

create index if not exists org_chart_saved_views_org_idx on public.org_chart_saved_views (organization_id);

-- ============================================================
-- 0106_org_positions.sql
-- ============================================================
-- 0106: Vacant & structural positions in the Org Chart — Workstream 7 of
-- the 2026-08-03 strategic memo's Org Chart line of work, following
-- directly on 0105's rebuild. Adds a way to represent a hierarchy node
-- that isn't a real employee: a hireable vacant slot (optionally linked to
-- a Hiring posting and/or a Job Architecture role), or a purely structural
-- box (a department/board/committee — never fillable), per Ahmed's
-- reference org chart and his concrete example of a manager-level slot
-- ("Head of HR") that can itself be vacant while still having a mix of
-- real and vacant reports underneath it.
--
-- Purely additive — organization_members.manager_user_id (the existing,
-- load-bearing reporting-line column read by Team Pulse, the performance-
-- review upline chain, onboarding manager-approval routing, and the
-- automation recipes) is completely untouched by this migration, and
-- setMemberManager (lib/orgChart/actions.ts) is not modified at all. A new
-- sibling column, manager_position_id, is added so a real employee can be
-- displayed as reporting to a vacant position; every existing consumer of
-- manager_user_id already treats null as "no manager" gracefully (verified
-- by reading each one), so a person whose manager slot is a vacancy simply
-- shows as "no manager" everywhere else in the app — no other feature
-- needs any code change.
--
-- Filling a vacant position does NOT delete its row. It's marked
-- status = 'filled' with occupant_user_id/filled_at set and kept as a
-- permanent record (which position an employee filled, how long it sat
-- vacant, what requisition created it via linked_posting_id) — this is
-- deliberately the foundation for a future Position History / Workforce
-- Planning view, not built in this pass. Only a position that's cancelled
-- before ever being filled is actually deleted.

create table if not exists public.org_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('vacant_role', 'structural')),
  -- Lifecycle, independent of kind. 'open'/'future'/'frozen' are
  -- admin-settable via updatePosition; 'filled' is system-set only, by
  -- fill_org_position() below. Structural nodes (a department/committee
  -- box has no hiring lifecycle) stay 'open' by convention — enforced by
  -- org_positions_structural_shape below.
  status text not null default 'open' check (status in ('open', 'future', 'frozen', 'filled')),
  title text not null,
  -- Mirrors WorkforceRow's structural fields so the existing country/
  -- business-unit/department Org Chart filters work over positions
  -- unchanged, with no separate filter system needed.
  department text,
  business_unit text,
  country text,
  location text,
  -- A position's parent is exactly one of: another position, a real
  -- employee, or root (both null) — enforced by org_positions_single_parent
  -- below. Left populated even after a fill (see fill_org_position) as a
  -- historical record of where the position used to sit in the tree.
  parent_position_id uuid references public.org_positions(id) on delete cascade,
  parent_member_user_id uuid references auth.users(id) on delete set null,
  -- Both independently optional per Ahmed's explicit confirmation ("can we
  -- have both linked if I want to not linked") — forbidden on structural
  -- nodes. linked_posting_id also doubles as "which requisition created
  -- this position" once set, for future history/analytics use.
  linked_posting_id uuid references public.job_postings(id) on delete set null,
  linked_role_id uuid references public.job_roles(id) on delete set null,
  -- Set only by fill_org_position(). Vacancy duration = filled_at - created_at.
  occupant_user_id uuid references auth.users(id) on delete set null,
  filled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_positions
  drop constraint if exists org_positions_single_parent;
alter table public.org_positions
  add constraint org_positions_single_parent
  check (not (parent_position_id is not null and parent_member_user_id is not null));

alter table public.org_positions
  drop constraint if exists org_positions_not_self_parent;
alter table public.org_positions
  add constraint org_positions_not_self_parent
  check (id is distinct from parent_position_id);

alter table public.org_positions
  drop constraint if exists org_positions_structural_shape;
alter table public.org_positions
  add constraint org_positions_structural_shape
  check (
    kind <> 'structural'
    or (status = 'open' and linked_posting_id is null and linked_role_id is null)
  );

alter table public.org_positions
  drop constraint if exists org_positions_filled_shape;
alter table public.org_positions
  add constraint org_positions_filled_shape
  check (
    (status = 'filled') = (occupant_user_id is not null)
  );

create index if not exists org_positions_org_idx on public.org_positions (organization_id);
create index if not exists org_positions_parent_position_idx on public.org_positions (parent_position_id);
create index if not exists org_positions_parent_member_idx on public.org_positions (parent_member_user_id);
create index if not exists org_positions_status_idx on public.org_positions (status);

alter table public.org_positions enable row level security;

drop policy if exists "Org members can view positions" on public.org_positions;
create policy "Org members can view positions"
  on public.org_positions for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins can create positions" on public.org_positions;
create policy "Org admins can create positions"
  on public.org_positions for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can update positions" on public.org_positions;
create policy "Org admins can update positions"
  on public.org_positions for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Deliberately NO delete policy — a direct client-side DELETE would
-- orphan/cascade-delete an entire subtree. Deletion only happens inside
-- delete_org_position() below, which re-parents affected children first.

alter table public.organization_members
  add column if not exists manager_position_id uuid references public.org_positions(id) on delete set null;

alter table public.organization_members
  drop constraint if exists organization_members_single_manager_kind;
alter table public.organization_members
  add constraint organization_members_single_manager_kind
  check (not (manager_user_id is not null and manager_position_id is not null));

create index if not exists organization_members_manager_position_idx on public.organization_members (manager_position_id);
-- No new RLS needed on organization_members — manager_position_id is
-- covered by the existing "org admins can update member records" UPDATE
-- policy (migration 0049) the same way manager_user_id already is.

-- Cancels a position that was never filled (a planned role that's off the
-- table, or a structural box being removed): re-parents its direct
-- children (both real members and other positions) up to its own parent,
-- then actually deletes the row — there's no occupant history to lose.
-- SECURITY DEFINER because it bypasses RLS to do a multi-row atomic
-- operation; does its own is_org_admin check since RLS itself is bypassed.
create or replace function public.delete_org_position(target_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_parent_position_id uuid;
  v_parent_member_user_id uuid;
begin
  select organization_id, parent_position_id, parent_member_user_id
    into v_org_id, v_parent_position_id, v_parent_member_user_id
    from public.org_positions
    where id = target_position_id;

  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'not authorized';
  end if;

  update public.organization_members
    set manager_position_id = v_parent_position_id,
        manager_user_id = v_parent_member_user_id
    where manager_position_id = target_position_id;

  update public.org_positions
    set parent_position_id = v_parent_position_id,
        parent_member_user_id = v_parent_member_user_id
    where parent_position_id = target_position_id;

  delete from public.org_positions where id = target_position_id;
end;
$$;

-- Fills a vacant role with a real employee: places them exactly where the
-- vacancy sat (mirrors its parent), moves the vacancy's own direct reports
-- (both real members and child positions) onto the new employee, then
-- marks the position row 'filled' with the occupant/timestamp recorded —
-- unlike delete_org_position, the row is kept as a permanent history
-- record, not deleted. Deliberately NOT wired into the automatic
-- onboarding trigger chain (runHireToOnboarding/instantiateOnboarding) —
-- called explicitly by an admin once the new hire's account already
-- exists. SECURITY DEFINER for the same reason as delete_org_position.
create or replace function public.fill_org_position(target_position_id uuid, target_employee_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_kind text;
  v_parent_position_id uuid;
  v_parent_member_user_id uuid;
begin
  select organization_id, kind, parent_position_id, parent_member_user_id
    into v_org_id, v_kind, v_parent_position_id, v_parent_member_user_id
    from public.org_positions
    where id = target_position_id;

  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'not authorized';
  end if;

  if v_kind <> 'vacant_role' then
    raise exception 'only a vacant role can be filled';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and user_id = target_employee_user_id
  ) then
    raise exception 'employee is not a member of this organization';
  end if;

  update public.organization_members
    set manager_user_id = v_parent_member_user_id,
        manager_position_id = v_parent_position_id
    where organization_id = v_org_id and user_id = target_employee_user_id;

  update public.organization_members
    set manager_position_id = null,
        manager_user_id = target_employee_user_id
    where manager_position_id = target_position_id;

  update public.org_positions
    set parent_position_id = null,
        parent_member_user_id = target_employee_user_id
    where parent_position_id = target_position_id;

  update public.org_positions
    set status = 'filled',
        occupant_user_id = target_employee_user_id,
        filled_at = now(),
        updated_at = now()
    where id = target_position_id;
end;
$$;

grant execute on function public.delete_org_position(uuid) to authenticated;
grant execute on function public.fill_org_position(uuid, uuid) to authenticated;

-- ============================================================
-- 0107_email_customization_gap.sql
-- ============================================================
-- 0107: Close the email-customization gap — widens organization_email_
-- messages to cover 8 more email types (4 that already existed but were
-- hardcoded, 4 that didn't exist as emails at all until this migration's
-- companion app code), relaxes its SELECT policy so non-admin-triggered
-- sends can still honor an admin's override, and adds the schema two new
-- cron-based reminder types need.
--
-- Why the SELECT policy changes: two of the newly-customizable emails
-- (hire_to_onboarding_manager_alert, high_potential_manager_alert) fire
-- from inside the TRIGGERING EMPLOYEE's own session, not an admin's (a new
-- hire signing up, or someone whose own Gap Analysis just ran) — this app
-- has no service-role key, so that read has to go through the same
-- RLS-bound client the request is already using. The 5 original reminder
-- types never hit this because they're read entirely inside SECURITY
-- DEFINER SQL functions (which bypass RLS); these two are read at the TS
-- level instead. Reading the customization TEXT isn't sensitive — it's
-- literally what gets emailed out — so member-read is the correct model;
-- only writing/managing it needs to stay admin-only, and those three
-- policies are untouched below.

-- 1. Widen the email_type check constraint (5 -> 13 values). It's an
-- unnamed inline constraint from 0101, so its actual name is looked up
-- rather than guessed, then replaced with an explicitly named one so a
-- future migration can reference it idempotently.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'organization_email_messages'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%email_type%';

  if constraint_name is not null then
    execute format('alter table public.organization_email_messages drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.organization_email_messages
  add constraint organization_email_messages_email_type_check
  check (email_type in (
    'task_reminder', 'certification_reminder', 'knowledge_hub_reminder',
    'performance_review_reminder', 'assessment_reminder',
    'knowledge_hub_assignment', 'employee_invite',
    'hire_to_onboarding_manager_alert', 'high_potential_manager_alert',
    'onboarding_step_reminder', 'onboarding_manager_approval_reminder',
    'milestone_assignment', 'interview_stage_notice'
  ));

-- 2. Relax SELECT: admin-only -> any org member. INSERT/UPDATE/DELETE stay
-- admin-gated (untouched below) — only reading the override text changes.
drop policy if exists "Org admins can view their email message overrides" on public.organization_email_messages;
drop policy if exists "Org members can view their org's email message overrides" on public.organization_email_messages;
create policy "Org members can view their org's email message overrides"
  on public.organization_email_messages for select
  using (public.is_org_member(organization_id));

-- 3. Re-remind spacing column for the two new onboarding reminder types.
-- One shared column is sufficient — step_type is exclusive, so a
-- manager_approval row is never also targeted by the employee-facing query.
alter table public.onboarding_instance_steps
  add column if not exists last_reminder_sent_at timestamptz;

-- 4. Employee-facing onboarding step reminder — task/knowledge_hub steps
-- only (never manager_approval, that's the separate function below).
-- onboarding_instances already carries organization_id directly, no
-- lateral org-lookup needed (unlike task/certification/assessment
-- reminders, whose source tables have no direct org column).
create or replace function public.due_onboarding_reminders(secret text)
returns table(
  step_id uuid,
  employee_user_id uuid,
  email text,
  full_name text,
  step_title text,
  due_date date,
  organization_id uuid,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select s.id, i.employee_user_id, p.email, p.full_name, s.title, s.due_date,
    i.organization_id, oem.custom_subject, oem.custom_message
  from public.onboarding_instance_steps s
  join public.onboarding_instances i on i.id = s.instance_id
  join public.profiles p on p.id = i.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = i.organization_id and oem.email_type = 'onboarding_step_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and s.step_type in ('task', 'knowledge_hub')
    and s.completed_at is null
    and p.email is not null
    and s.due_date is not null
    and s.due_date <= current_date
    and (s.last_reminder_sent_at is null or s.last_reminder_sent_at < now() - interval '7 days');
$$;

revoke all on function public.due_onboarding_reminders(text) from public;
grant execute on function public.due_onboarding_reminders(text) to anon, authenticated;

create or replace function public.mark_onboarding_reminder_sent(secret text, target_step_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.onboarding_instance_steps set last_reminder_sent_at = now()
  where id = target_step_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_onboarding_reminder_sent(text, uuid) from public;
grant execute on function public.mark_onboarding_reminder_sent(text, uuid) to anon, authenticated;

-- 5. Manager-facing onboarding approval nudge — manager_approval steps
-- only. Manager resolved via organization_members.manager_user_id, the
-- same relationship is_manager_of_user() (0078) encodes, written inline
-- here since the function needs the manager's own row, not just a boolean.
-- No due_date requirement — a pending approval has no deadline of its own,
-- it just nudges once it's sat unremimded for 7 days (same "no due date,
-- use elapsed time" shape as assigned_assessments in 0101).
create or replace function public.due_onboarding_manager_approval_reminders(secret text)
returns table(
  step_id uuid,
  manager_user_id uuid,
  email text,
  full_name text,
  employee_name text,
  step_title text,
  organization_id uuid,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select s.id, om.manager_user_id, mp.email, mp.full_name, ep.full_name, s.title,
    i.organization_id, oem.custom_subject, oem.custom_message
  from public.onboarding_instance_steps s
  join public.onboarding_instances i on i.id = s.instance_id
  join public.organization_members om on om.user_id = i.employee_user_id and om.organization_id = i.organization_id
  join public.profiles mp on mp.id = om.manager_user_id
  join public.profiles ep on ep.id = i.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = i.organization_id and oem.email_type = 'onboarding_manager_approval_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and s.step_type = 'manager_approval'
    and s.completed_at is null
    and om.manager_user_id is not null
    and mp.email is not null
    and (s.last_reminder_sent_at is null or s.last_reminder_sent_at < now() - interval '7 days');
$$;

revoke all on function public.due_onboarding_manager_approval_reminders(text) from public;
grant execute on function public.due_onboarding_manager_approval_reminders(text) to anon, authenticated;

create or replace function public.mark_onboarding_manager_approval_reminder_sent(secret text, target_step_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.onboarding_instance_steps set last_reminder_sent_at = now()
  where id = target_step_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_onboarding_manager_approval_reminder_sent(text, uuid) from public;
grant execute on function public.mark_onboarding_manager_approval_reminder_sent(text, uuid) to anon, authenticated;

-- ============================================================
-- 0108_org_positions_headcount_details.sql
-- ============================================================
-- 0108: Headcount + details on org_positions — lets an admin annotate a
-- structural/vacant box in the Org Chart (e.g. a "Public Works" department
-- box with no single person attached) with a manually-entered headcount
-- number and a free-text description, per Ahmed's ask to "create a box
-- somewhere with title, headcount, and details." Headcount is
-- admin-entered rather than auto-counted from the chart — the org chart
-- isn't always fully populated, so a manual number is more useful than an
-- auto-count that could read as artificially low. Both columns are
-- nullable and apply to either position kind (vacant_role or structural) —
-- no reason to restrict either field to just one kind.

alter table public.org_positions
  add column if not exists headcount integer,
  add column if not exists details text;

-- ============================================================
-- 0109_review_cycle_participants.sql
-- ============================================================
-- 0109: Scope a performance review cycle to specific employees
--
-- ensure_reviews_for_cycle (0076, redefined 0103) has always unconditionally
-- seeded a review for EVERY member of the organization — there was no "who
-- is this cycle for" concept anywhere in the schema. That's exactly right
-- for a company-wide annual cycle, but wrong for something like a
-- single-person probation review, which would otherwise silently create a
-- probation review for the entire workforce.
--
-- Opt-in, fully backward-compatible: a cycle with zero rows in the new
-- performance_review_cycle_participants table behaves byte-for-byte
-- identically to today (seeds the whole org) — every existing cycle and the
-- common whole-company case need no change at all. A cycle WITH participant
-- rows only seeds reviews for those specific employees. Scope is fixed at
-- creation time only in this pass — no editing an already-running cycle's
-- participant list.

create table if not exists public.performance_review_cycle_participants (
  cycle_id uuid not null references public.performance_review_cycles(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  primary key (cycle_id, employee_user_id)
);

alter table public.performance_review_cycle_participants enable row level security;

-- Admin-only in both directions — nothing employee-facing ever reads this
-- table, it's purely an admin-set creation parameter consumed inside the
-- SECURITY DEFINER ensure_reviews_for_cycle below.
drop policy if exists "Org admins can manage cycle participants" on public.performance_review_cycle_participants;
create policy "Org admins can manage cycle participants"
  on public.performance_review_cycle_participants for all
  using (exists (
    select 1 from public.performance_review_cycles c
    where c.id = performance_review_cycle_participants.cycle_id and public.is_org_admin(c.organization_id)
  ))
  with check (exists (
    select 1 from public.performance_review_cycles c
    where c.id = performance_review_cycle_participants.cycle_id and public.is_org_admin(c.organization_id)
  ));

-- Identical to the 0103 version (template resolution, instance-step
-- snapshot, resolve_custom_step_role_assignments tail) except the seeding
-- insert now respects a participant scope when one exists.
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
  v_has_participants boolean;
begin
  select organization_id into v_org_id from public.performance_review_cycles where id = target_cycle_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;

  select exists(
    select 1 from public.performance_review_cycle_participants where cycle_id = target_cycle_id
  ) into v_has_participants;

  insert into public.performance_reviews (cycle_id, organization_id, employee_user_id)
  select target_cycle_id, v_org_id, m.user_id
  from public.organization_members m
  where m.organization_id = v_org_id
    and (
      not v_has_participants
      or exists (
        select 1 from public.performance_review_cycle_participants p
        where p.cycle_id = target_cycle_id and p.employee_user_id = m.user_id
      )
    )
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

-- ============================================================
-- 0110_assessment_due_date.sql
-- ============================================================
-- 0110: Optional deadline on assigned_assessments + a new
-- assessment_assignment email type
--
-- Migration 0101 deliberately gave assigned_assessments no due-date
-- concept ("open-ended assignment, not a deadline") — reversed here since
-- the product need has changed: an admin can now optionally set a
-- deadline when assigning an assessment, which shows up in the assignment
-- email and on the employee's calendar. Nullable — assigning without a
-- date keeps today's open-ended behavior exactly as-is.

alter table public.assigned_assessments
  add column if not exists due_date date;

-- Widen organization_email_messages.email_type to allow the new
-- assessment_assignment type — the immediate "you've been assigned this
-- assessment" notice, same treatment milestone_assignment already got in
-- 0107. That migration replaced the original inline/unnamed check
-- constraint with an explicitly named one specifically so this kind of
-- follow-up widening never has to guess a Postgres-generated name again.
alter table public.organization_email_messages
  drop constraint if exists organization_email_messages_email_type_check;
alter table public.organization_email_messages
  add constraint organization_email_messages_email_type_check
  check (email_type in (
    'task_reminder', 'certification_reminder', 'knowledge_hub_reminder',
    'performance_review_reminder', 'assessment_reminder',
    'knowledge_hub_assignment', 'employee_invite',
    'hire_to_onboarding_manager_alert', 'high_potential_manager_alert',
    'onboarding_step_reminder', 'onboarding_manager_approval_reminder',
    'milestone_assignment', 'interview_stage_notice',
    'assessment_assignment'
  ));

-- ============================================================
-- 0111_platform_admin_data_deletion.sql
-- ============================================================
-- 0111: Platform-admin-triggered data deletion (any user, not just an org's
-- own employees)
--
-- admin_schedule_employee_data_deletion (migration 0066) only works when
-- the caller is the target's own org admin (is_org_admin_of_user) — it
-- can't be used by a platform admin (profiles.is_admin = true) to schedule
-- deletion for an arbitrary user across the whole platform, e.g. cleaning
-- up a test/demo account or an individual user with no organization at
-- all. This mirrors 0066's pair of functions exactly, just gated on the
-- caller's own is_admin flag instead of org-admin-of-user — same
-- SECURITY DEFINER, narrowly-scoped-to-one-column approach (not a blanket
-- RLS UPDATE policy on profiles), same underlying pending_data_deletion_at
-- column and daily purge cron (migration 0059) as every other path into
-- this same deletion mechanism.

create or replace function public.platform_admin_schedule_data_deletion(target_user_id uuid, grace_days int default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  deletion_at timestamptz;
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  deletion_at := now() + (grace_days || ' days')::interval;
  update public.profiles set pending_data_deletion_at = deletion_at where id = target_user_id;

  return deletion_at;
end;
$$;

revoke all on function public.platform_admin_schedule_data_deletion(uuid, int) from public;
grant execute on function public.platform_admin_schedule_data_deletion(uuid, int) to authenticated;

create or replace function public.platform_admin_cancel_data_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception 'Not authorized';
  end if;

  update public.profiles set pending_data_deletion_at = null where id = target_user_id;
end;
$$;

revoke all on function public.platform_admin_cancel_data_deletion(uuid) from public;
grant execute on function public.platform_admin_cancel_data_deletion(uuid) to authenticated;

-- ============================================================
-- 0112_profile_disable_access.sql
-- ============================================================
-- 0112: Let a platform admin disable a user's access (in addition to the
-- existing "wipe their data" mechanism from 0111) — separate concepts:
-- disabling blocks login/use of the app without touching any of their
-- content, wiping data does the opposite (keeps the login, clears the
-- content). Both are meant to be used independently or together.
--
-- is_disabled updates go through the existing "Platform admins can update
-- any profile" RLS policy (migration 0091) — no new SECURITY DEFINER
-- function needed for the toggle itself, same as subscription_tier and
-- monthly_ai_budget_usd already do. The one thing that DOES need updating
-- is 0092's self-escalation guard: without adding is_disabled to it, a
-- disabled user could simply flip their own flag back to false via a
-- direct client update, defeating the whole feature.

alter table public.profiles
  add column if not exists is_disabled boolean not null default false;

-- The self-update policy itself must be dropped before the function it
-- depends on can be — Postgres refuses to drop a function a live policy
-- still references, `if exists` or not. Recreated at the bottom of this
-- file once the new 6-param function exists.
drop policy if exists "Users can update their own profile" on public.profiles;

-- Signature is changing (6 params instead of 5), so this needs a drop
-- first — `create or replace` can't change a function's parameter list.
drop function if exists public.profile_admin_fields_unchanged(uuid, boolean, text, timestamptz, numeric);

create or replace function public.profile_admin_fields_unchanged(
  target_user_id uuid,
  new_is_admin boolean,
  new_subscription_tier text,
  new_premium_trial_expires_at timestamptz,
  new_monthly_ai_budget_usd numeric,
  new_is_disabled boolean
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = target_user_id
        and new_is_admin is not distinct from p.is_admin
        and new_subscription_tier is not distinct from p.subscription_tier
        and new_premium_trial_expires_at is not distinct from p.premium_trial_expires_at
        and new_monthly_ai_budget_usd is not distinct from p.monthly_ai_budget_usd
        and new_is_disabled is not distinct from p.is_disabled
    );
$$;

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_admin_fields_unchanged(
      id, is_admin, subscription_tier, premium_trial_expires_at, monthly_ai_budget_usd, is_disabled
    )
  );

-- ============================================================
-- 0113_organization_disable_access.sql
-- ============================================================
-- 0113: Org-level equivalent of 0112's profiles.is_disabled
--
-- Enterprise has no "free" fallback tier (it's Custom/sales-priced, no
-- self-serve downgrade path — confirmed against the pricing page copy),
-- so a lapsed enterprise payment can't be handled the same way the
-- individual LemonSqueezy webhook handles it (downgrade to free). The
-- only sensible failure mode for a company account is blocking the whole
-- workspace, not one person — disabling a single admin's profile
-- (migration 0112) wouldn't lock out the rest of the company.
--
-- Goes through the existing "Platform admins can update organizations"
-- policy (migration 0079, no column restrictions) — same pattern as
-- seat_limit and monthly_ai_budget_usd already use, no new SECURITY
-- DEFINER function needed.
--
-- Deliberately manual-only for now, not wired to any billing webhook —
-- enterprise deals are sold via "Talk to sales" (custom/invoiced), not a
-- self-serve subscription with lifecycle events to react to.

alter table public.organizations
  add column if not exists is_disabled boolean not null default false;

-- ============================================================
-- 0114_feature_restrictions.sql
-- ============================================================
-- Granular per-feature access control for Enterprise orgs. Every access rule
-- in this app up to now has been coarse and all-or-nothing: subscription
-- tier (free/premium/enterprise), org-admin-or-not, or a full account/org
-- disable (migrations 0112/0113). This adds the missing middle layer: an
-- org admin restricting ONE specific module (AI Coaching, Resume
-- Intelligence/ATS optimization, Roleplay, Career Development, Knowledge
-- Hub, Job Architecture, Competency Management) for a specific employee or
-- a whole department, while everything else stays available. Default is
-- opt-out (everything enabled) — a restriction row is only ever a "this is
-- OFF for this person/department" entry, never an allow-list.

create table if not exists public.organization_feature_restrictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key text not null,
  scope_type text not null check (scope_type in ('user', 'department')),
  user_id uuid references auth.users (id) on delete cascade,
  department text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint org_feature_restrictions_scope_shape check (
    (scope_type = 'user' and user_id is not null and department is null)
    or (scope_type = 'department' and department is not null and user_id is null)
  )
);

-- Two partial unique indexes rather than one plain unique constraint on
-- (organization_id, feature_key, scope_type, user_id, department) — Postgres
-- treats every NULL as distinct in a unique constraint, so a plain one would
-- silently let duplicate department-scoped rows through (user_id is always
-- null there) and vice versa. Partial indexes scoped to each branch actually
-- enforce "one restriction per feature per person/department."
create unique index if not exists org_feature_restrictions_user_uidx
  on public.organization_feature_restrictions (organization_id, feature_key, user_id)
  where scope_type = 'user';
create unique index if not exists org_feature_restrictions_dept_uidx
  on public.organization_feature_restrictions (organization_id, feature_key, department)
  where scope_type = 'department';

create index if not exists org_feature_restrictions_org_idx
  on public.organization_feature_restrictions (organization_id);

alter table public.organization_feature_restrictions enable row level security;

-- Management (select/insert/update/delete) is admin-only — same "for all"
-- shape as 0081's platform-admin invites policy. Regular employees never
-- get raw table access at all; they only ever learn whether THEY are
-- restricted via the SECURITY DEFINER function below, which needs no grant
-- on the table itself.
drop policy if exists "Org admins can manage their org's feature restrictions" on public.organization_feature_restrictions;
create policy "Org admins can manage their org's feature restrictions"
  on public.organization_feature_restrictions for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Platform admins can manage any org's feature restrictions" on public.organization_feature_restrictions;
create policy "Platform admins can manage any org's feature restrictions"
  on public.organization_feature_restrictions for all
  using (public.is_admin())
  with check (public.is_admin());

-- The single function every gated feature actually calls: every restricted
-- feature key for the CALLING user, across both their individual
-- user-scoped restrictions and their department's restrictions (looked up
-- from their own organization_members row, never a client-supplied value).
-- One round trip covers both a single feature check (`'x' = any(result)`)
-- and bulk nav-hiding (checking several keys against the same array) without
-- needing N separate calls. Wrapped in exception handling and returns an
-- empty (nothing restricted) array on any failure — a broken restriction
-- check must never block real feature use, same fail-open posture as
-- assertAiBudgetOk.
create or replace function public.list_my_restricted_features(check_org_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  my_department text;
  result text[];
begin
  select department into my_department
  from public.organization_members
  where organization_id = check_org_id and user_id = auth.uid()
  limit 1;

  select coalesce(array_agg(distinct r.feature_key), '{}')
  into result
  from public.organization_feature_restrictions r
  where r.organization_id = check_org_id
    and (
      (r.scope_type = 'user' and r.user_id = auth.uid())
      or (r.scope_type = 'department' and my_department is not null and r.department = my_department)
    );

  return coalesce(result, '{}');
exception when others then
  return '{}';
end;
$$;

revoke all on function public.list_my_restricted_features(uuid) from public;
grant execute on function public.list_my_restricted_features(uuid) to authenticated;

-- ============================================================
-- 0115_knowledge_hub_content_versions.sql
-- ============================================================
-- Knowledge Hub content management gaps, part 1: version history. Every
-- edit to a live content item (title, description, passing score, max
-- attempts, due date) gets a snapshot row of what it looked like
-- immediately BEFORE the edit, written from updateKnowledgeHubContent
-- (lib/knowledgeHub/actions.ts) in the same request. Denormalized
-- organization_id (rather than joining through content_id for RLS) matches
-- the pattern already used elsewhere in this schema (e.g. ai_usage_events)
-- — set once at insert time from the content row's own organization_id, it
-- never changes after.

create table if not exists public.knowledge_hub_content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.knowledge_hub_content (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  passing_score_percent integer not null,
  max_attempts integer,
  due_date date,
  edited_by uuid not null references auth.users (id) on delete set null,
  edited_at timestamptz not null default now()
);

create index if not exists knowledge_hub_content_versions_content_idx
  on public.knowledge_hub_content_versions (content_id, edited_at desc);

alter table public.knowledge_hub_content_versions enable row level security;

-- Same posture as knowledge_hub_content itself (0084) — org admins only,
-- no employee-facing read policy. Version history is an admin governance
-- tool, not learner-facing content.
drop policy if exists "Org admins manage knowledge hub content versions" on public.knowledge_hub_content_versions;
create policy "Org admins manage knowledge hub content versions"
  on public.knowledge_hub_content_versions for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Part 2: adds knowledge_hub_content_updated as a customizable email type —
-- an optional notice to already-enrolled learners when an admin makes a
-- significant edit to content they're assigned. Same named-constraint
-- widening pattern 0107/0110 established specifically so this never needs
-- to guess a Postgres-generated constraint name.
alter table public.organization_email_messages
  drop constraint if exists organization_email_messages_email_type_check;
alter table public.organization_email_messages
  add constraint organization_email_messages_email_type_check
  check (email_type in (
    'task_reminder', 'certification_reminder', 'knowledge_hub_reminder',
    'performance_review_reminder', 'assessment_reminder',
    'knowledge_hub_assignment', 'employee_invite',
    'hire_to_onboarding_manager_alert', 'high_potential_manager_alert',
    'onboarding_step_reminder', 'onboarding_manager_approval_reminder',
    'milestone_assignment', 'interview_stage_notice', 'assessment_assignment',
    'knowledge_hub_content_updated'
  ));

-- ============================================================
-- 0116_feature_scheduled_emails.sql
-- ============================================================
-- Feature-level ad-hoc email compose & send — one shared engine reused by
-- Knowledge Hub, Impact Cycles (Performance Reviews), Surveys, and
-- Assessments, replacing the "only fixed-template, auto-triggered emails"
-- pattern those four features were limited to before. One table serves
-- three jobs at once: the send queue (a row with sent_at null and
-- send_at in the future), the immediate-send record (sent_at set the
-- moment it's sent), and the send-history log (every row, forever) — all
-- the same rows, just read differently depending on what's being shown.

create table if not exists public.feature_scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key text not null check (feature_key in ('knowledge_hub', 'performance_review', 'survey', 'assessment')),
  subject text not null,
  message text not null,
  recipient_user_ids uuid[] not null,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_count integer,
  failed_count integer,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists feature_scheduled_emails_org_idx
  on public.feature_scheduled_emails (organization_id, feature_key, created_at desc);
-- Partial index scoped to exactly what the cron sweep queries — a table
-- that accumulates years of history never makes that lookup slower.
create index if not exists feature_scheduled_emails_due_idx
  on public.feature_scheduled_emails (send_at)
  where sent_at is null;

alter table public.feature_scheduled_emails enable row level security;

drop policy if exists "Org admins manage their feature scheduled emails" on public.feature_scheduled_emails;
create policy "Org admins manage their feature scheduled emails"
  on public.feature_scheduled_emails for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Cron-side read: same secret-gated SECURITY DEFINER pattern every due_*
-- reminder function already uses (0054/0101) — the cron route has no user
-- session at all, so RLS can't be the gate here; the secret comparison
-- inside the function is. Returns nothing (not an error) on a wrong
-- secret, same as every sibling due_* function.
--
-- Recipient email/name are resolved and returned INLINE (a jsonb array),
-- not left as raw recipient_user_ids for the route to look up afterward —
-- the route's own supabase client has no session in a cron context, so a
-- separate .from("profiles") read from there would just hit RLS and
-- return nothing. Every due_* reminder function in this schema does the
-- same thing for the same reason.
create or replace function public.due_scheduled_feature_emails(secret text)
returns table (
  id uuid,
  organization_id uuid,
  feature_key text,
  subject text,
  message text,
  recipients jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id,
    e.organization_id,
    e.feature_key,
    e.subject,
    e.message,
    coalesce(
      (select jsonb_agg(jsonb_build_object('email', p.email, 'fullName', p.full_name))
       from public.profiles p
       where p.id = any(e.recipient_user_ids) and p.email is not null),
      '[]'::jsonb
    ) as recipients
  from public.feature_scheduled_emails e
  where e.sent_at is null
    and e.send_at <= now()
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.due_scheduled_feature_emails(text) from public;
grant execute on function public.due_scheduled_feature_emails(text) to authenticated;

create or replace function public.mark_scheduled_feature_email_sent(
  secret text,
  target_id uuid,
  p_sent_count integer,
  p_failed_count integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.feature_scheduled_emails
  set sent_at = now(), sent_count = p_sent_count, failed_count = p_failed_count
  where id = target_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_scheduled_feature_email_sent(text, uuid, integer, integer) from public;
grant execute on function public.mark_scheduled_feature_email_sent(text, uuid, integer, integer) to authenticated;

