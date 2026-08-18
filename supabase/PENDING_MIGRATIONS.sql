-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0120 THROUGH 0126
--
-- Everything through 0119 has been confirmed applied already.
-- 0120-0123 are the 5-part program's original batch; 0124 is a
-- UX-audit follow-up (two more customizable alert emails) added
-- right after; 0125 adds a small standalone table for Org Chart
-- free-text notes; 0126 is a process-delay-audit follow-up (manager-
-- action reminders for the manager_assessment step and probation
-- acceptance, plus a bugfix to the existing self-assessment reminder).
-- Every statement is idempotent, so re-running any part that already
-- succeeded is still safe.
--
-- Apply in this exact order.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run. If anything errors partway, copy the exact
-- error text back so it can be diagnosed rather than re-run blind.
-- ============================================================

-- ============================================================
-- 0120_knowledge_hub_new_hire_flag.sql
-- ============================================================
-- 0120: Knowledge Hub content can be flagged for automatic new-hire assignment
--
-- Part of retiring the standalone Onboarding checklist feature (migration
-- 0102) in favor of treating onboarding-relevant documents as ordinary
-- Knowledge Hub content, per the CEO's own framing ("onboarding is just
-- policies and hiring documents — fold it into Knowledge Hub"). This is
-- deliberately a single boolean, not a category/tag system — an admin
-- marks specific documents as "assign automatically to new hires," and
-- lib/automations/recipes.ts's runHireWelcome (replacing the old
-- runHireToOnboarding) assigns every flagged, unarchived document to a
-- new employee via the existing assignKnowledgeHubContent path — no new
-- assignment/notification machinery needed.
--
-- onboarding_templates/_template_steps/_instances/_instance_steps
-- (migration 0102) are deliberately NOT dropped here — see
-- lib/organizations/emailMessageTypes.ts's certification_reminder comment
-- for the established precedent: this runs against production data with
-- an unknown number of in-flight onboarding instances, and there is no
-- performance/security cost to an unused table. The app simply stops
-- reading/writing them after this change.

alter table public.knowledge_hub_content
  add column if not exists is_new_hire_content boolean not null default false;

-- Version history (migration 0115) snapshots every field updateKnowledgeHubContent
-- can edit — is_new_hire_content becomes one of those fields below, so it
-- needs the same before-edit snapshot column. Nullable (unlike the content
-- table's own column) since old version rows predate this flag entirely.
alter table public.knowledge_hub_content_versions
  add column if not exists is_new_hire_content boolean;

-- runHireWelcome (lib/automations/recipes.ts) calls assignKnowledgeHubContent
-- from inside the NEW EMPLOYEE'S OWN session (checkAndConsumeInvite — there's
-- no service-role key to act on their behalf). The existing insert policy on
-- knowledge_hub_assignments (migration 0084) only allows
-- is_org_admin_of_user(employee_user_id), which a brand-new, non-admin
-- employee never satisfies for themselves. This adds a narrowly-scoped
-- second permissive policy (OR'd with the admin one) that only lets someone
-- insert their OWN assignment row, and only for content the org has
-- explicitly flagged is_new_hire_content — it does not let an employee
-- self-assign arbitrary Knowledge Hub content.
drop policy if exists "Employees can self-assign new-hire content" on public.knowledge_hub_assignments;
create policy "Employees can self-assign new-hire content"
  on public.knowledge_hub_assignments for insert
  with check (
    employee_user_id = auth.uid()
    and exists (
      select 1 from public.knowledge_hub_content c
      where c.id = content_id and c.is_new_hire_content = true and c.archived_at is null
    )
  );

-- ============================================================
-- 0121_org_chart_snapshots.sql
-- ============================================================
-- 0121: Org Chart structural snapshots + reset
--
-- Part 3 of the CEO's 2026-08-11 5-part program: "add more i can create new
-- chart after i save one so that i can redevelop new chart." Investigation
-- showed org_chart_saved_views (migration 0105) only stores DISPLAY config
-- (toggles/density/filters) — never the actual reporting-line structure —
-- so there was no way to preserve a past arrangement before redesigning.
-- This adds a real point-in-time structural snapshot (who reported to whom)
-- plus a reset action that clears the live tree back to a blank slate for a
-- redesign. Deliberately NOT a "restore" — re-applying a snapshot's edges
-- onto live data risks silently resurrecting stale manager references for
-- people who've since left; a snapshot is a read-only historical record,
-- not an undo point.

create table if not exists public.org_chart_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Shape: { members: [{ userId, name, title, managerUserId, managerPositionId }],
  -- positions: [{ id, title, kind, status, parentPositionId, parentMemberUserId }] }.
  -- Denormalized (name/title copied in, not just ids) so a snapshot stays
  -- meaningful to view even after the people/positions it references are
  -- later renamed, reassigned, or removed — same reasoning as every other
  -- point-in-time record in this schema (self-assessment snapshots,
  -- workflow step response payloads). Validated in TypeScript
  -- (lib/orgChart/snapshots.ts), not in Postgres, same posture as
  -- org_chart_saved_views.config.
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.org_chart_snapshots enable row level security;

drop policy if exists "Org admins can manage org chart snapshots" on public.org_chart_snapshots;
create policy "Org admins can manage org chart snapshots"
  on public.org_chart_snapshots for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart snapshots" on public.org_chart_snapshots;
create policy "Org members can view org chart snapshots"
  on public.org_chart_snapshots for select
  using (public.is_org_member(organization_id));

create index if not exists org_chart_snapshots_org_idx on public.org_chart_snapshots (organization_id);

-- Clears the live reporting-line tree back to a blank slate for a redesign.
-- Does NOT delete org_positions rows — only clears parent_position_id/
-- parent_member_user_id — so a planned-but-vacant role (e.g. a Job
-- Architecture-linked opening) survives a reset instead of being silently
-- destroyed. Atomic (one RPC, not a client-side loop) specifically so a
-- failure can't leave the chart half-reset. SECURITY DEFINER + explicit
-- is_org_admin check, same posture as delete_org_position/fill_org_position
-- (migration 0106).
create or replace function public.reset_org_chart(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(target_organization_id) then
    raise exception 'not authorized';
  end if;

  update public.organization_members
    set manager_user_id = null,
        manager_position_id = null
    where organization_id = target_organization_id;

  update public.org_positions
    set parent_position_id = null,
        parent_member_user_id = null,
        updated_at = now()
    where organization_id = target_organization_id;
end;
$$;

grant execute on function public.reset_org_chart(uuid) to authenticated;

-- ============================================================
-- 0122_probation_automation.sql
-- ============================================================
-- 0122: Automated single-employee review cycles + probation acceptance gate
--
-- Part 4 of the CEO's 2026-08-11 5-part program: "hr can schedule the
-- email, the hiring manager should review and accept the probation
-- template, and hr can review and approve anytime." The probation_review
-- starter template (lib/performanceReviews/starterTemplates.ts) already
-- exists and is already usable manually by an admin — this wires it into
-- the hire-invite automation chain and adds the accept gate.
--
-- WHY A NEW RPC RATHER THAN REUSING createReviewCycle/ensure_reviews_for_cycle:
-- createReviewCycle (lib/performanceReviews/actions.ts) checks the CALLER's
-- own is_org_admin membership — correct for an admin creating a cycle from
-- the UI, but wrong here: this fires inside checkAndConsumeInvite, i.e. in
-- the NEW EMPLOYEE'S OWN session (self-scoped, same posture as Knowledge
-- Hub's runHireWelcome), and a brand-new employee is never an org admin.
-- Composing the existing admin-gated ensure_reviews_for_cycle /
-- resolve_custom_step_role_assignments internally doesn't work either —
-- SECURITY DEFINER doesn't change auth.uid(), so those functions' own
-- internal is_org_admin(...) checks would still evaluate against the new
-- employee and reject. create_automated_review_cycle below is therefore a
-- self-contained SECURITY DEFINER RPC that authorizes itself (self-scoped
-- OR org-admin OR the target's own manager — covers both this Part 4 call
-- site and Part 5's manager-initiated mid-year trigger) and does its own
-- minimal step-seeding rather than calling the admin-only helpers.
--
-- Deliberately narrow: only the two starter keys this program actually
-- automates ('probation_review' now, 'mid_year_checkin' added in Part 5)
-- are supported — this is not a generic "clone any starter via RPC" engine.
-- Everything else still goes through the existing admin-only
-- cloneStarterTemplate (TypeScript, reads the full static catalog). The
-- step data literals below are hand-mirrored from starterTemplates.ts's
-- probation_review/mid_year_checkin entries — same "SQL hardcodes what the
-- TS catalog defines" precedent migration 0103's own backfill already set
-- for the STANDARD_FIVE steps.
--
-- The created template is NOT marked is_default — it's a dedicated,
-- single-cycle template that must never become the org's fallback template
-- for its ordinary annual/quarterly cycles.

alter table public.performance_reviews
  add column if not exists requires_hiring_manager_acceptance boolean not null default false,
  add column if not exists hiring_manager_accepted_at timestamptz,
  add column if not exists hiring_manager_accepted_by uuid references auth.users(id) on delete set null;

create or replace function public.create_automated_review_cycle(
  p_employee_user_id uuid,
  p_starter_key text,
  p_cycle_name text,
  p_opens_at date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_template_id uuid;
  v_cycle_id uuid;
  v_review_id uuid;
  v_step_id uuid;
  v_admin_user_id uuid;
begin
  select organization_id into v_org_id
  from public.organization_members
  where user_id = p_employee_user_id
  limit 1;

  if v_org_id is null then
    raise exception 'Employee is not a member of any organization';
  end if;

  if not (
    p_employee_user_id = auth.uid()
    or public.is_org_admin(v_org_id)
    or public.is_manager_of_user(p_employee_user_id)
  ) then
    raise exception 'Not authorized';
  end if;

  if p_starter_key not in ('probation_review', 'mid_year_checkin') then
    raise exception 'Unsupported starter key for automated cycles: %', p_starter_key;
  end if;

  insert into public.performance_review_workflow_templates (organization_id, name, is_default)
  values (v_org_id, coalesce(nullif(trim(p_cycle_name), ''), p_starter_key) || ' Template', false)
  returning id into v_template_id;

  if p_starter_key = 'probation_review' then
    insert into public.performance_review_workflow_steps (template_id, position, step_type, title, data)
    values
      (v_template_id, 0, 'manager_assessment', 'Probation Assessment', '{}'::jsonb),
      (v_template_id, 1, 'custom', 'HR Review',
        '{"custom_kind":"hr_review","response_shape":"approval","multi_respondent":false,"min_respondents":null,"max_respondents":null,"assignment":{"mode":"role","role":"org_admin"},"anonymize_to_employee":false,"ai_assist_enabled":true}'::jsonb),
      (v_template_id, 2, 'conclusion', 'Outcome', '{}'::jsonb);
  else -- mid_year_checkin
    insert into public.performance_review_workflow_steps (template_id, position, step_type, title, data)
    values
      (v_template_id, 0, 'self_assessment', 'Self-Reflection', '{}'::jsonb),
      (v_template_id, 1, 'goals', 'Goals & Progress', '{}'::jsonb),
      (v_template_id, 2, 'manager_assessment', 'Manager''s Perspective', '{}'::jsonb),
      (v_template_id, 3, 'conclusion', 'Conclusion', '{}'::jsonb);
  end if;

  insert into public.performance_review_cycles (organization_id, name, status, created_by, opens_at, workflow_template_id)
  values (v_org_id, coalesce(nullif(trim(p_cycle_name), ''), initcap(replace(p_starter_key, '_', ' '))), 'open', auth.uid(), p_opens_at, v_template_id)
  returning id into v_cycle_id;

  insert into public.performance_review_cycle_participants (cycle_id, employee_user_id)
  values (v_cycle_id, p_employee_user_id);

  insert into public.performance_reviews (cycle_id, organization_id, employee_user_id, requires_hiring_manager_acceptance)
  values (v_cycle_id, v_org_id, p_employee_user_id, p_starter_key = 'probation_review')
  returning id into v_review_id;

  insert into public.performance_review_instance_steps (review_id, workflow_step_id, position, step_type, title, description, data)
  select v_review_id, ws.id, ws.position, ws.step_type, ws.title, ws.description, ws.data
  from public.performance_review_workflow_steps ws
  where ws.template_id = v_template_id
  order by ws.position;

  -- Inline resolution of the probation template's one custom step
  -- (assignment.role = 'org_admin') — mirrors resolve_custom_step_role_
  -- assignments' 'org_admin' branch exactly, but must be inlined here (see
  -- header comment) rather than calling that function directly.
  if p_starter_key = 'probation_review' then
    select id into v_step_id
    from public.performance_review_instance_steps
    where review_id = v_review_id and step_type = 'custom'
    limit 1;

    select user_id into v_admin_user_id
    from public.organization_members
    where organization_id = v_org_id and role = 'admin'
    limit 1;

    if v_step_id is not null and v_admin_user_id is not null then
      insert into public.performance_review_custom_step_assignments (instance_step_id, review_id, assignee_user_id, assigned_by)
      values (v_step_id, v_review_id, v_admin_user_id, null)
      on conflict (instance_step_id, assignee_user_id) do nothing;
    end if;
  end if;

  return v_review_id;
end;
$$;

revoke all on function public.create_automated_review_cycle(uuid, text, text, date) from public;
grant execute on function public.create_automated_review_cycle(uuid, text, text, date) to authenticated;

-- Hiring-manager acceptance gate: getMyCurrentReview (lib/performanceReviews/
-- actions.ts) will exclude any review where requires_hiring_manager_
-- acceptance is true and hiring_manager_accepted_at is still null, so the
-- new hire simply doesn't see the probation review exists until this runs.
-- is_manager_of_user-gated per the CEO's framing ("the hiring manager
-- should review and accept") — org admins ALSO pass this (same "admin can
-- always do what a manager can do for their org" posture as
-- submit_manager_assessment/close_review), matching "HR can review and
-- approve anytime."
create or replace function public.accept_probation_review(target_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_requires boolean;
begin
  select organization_id, employee_user_id, requires_hiring_manager_acceptance
    into v_org_id, v_employee, v_requires
    from public.performance_reviews
    where id = target_review_id;

  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  if not v_requires then
    raise exception 'This review does not require hiring-manager acceptance';
  end if;

  update public.performance_reviews
    set hiring_manager_accepted_at = now(),
        hiring_manager_accepted_by = auth.uid()
    where id = target_review_id;
end;
$$;

revoke all on function public.accept_probation_review(uuid) from public;
grant execute on function public.accept_probation_review(uuid) to authenticated;

-- ============================================================
-- 0123_self_assessment_reflection_fields.sql
-- ============================================================
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

-- ============================================================
-- 0124_probation_and_midyear_alert_emails.sql
-- ============================================================
-- 0124: Two more customizable automation-fired alert emails
--
-- UX audit follow-up on the 2026-08-11 5-part program: neither the
-- hire_to_probation nor the low_manager_rating_to_midyear automation
-- (both shipped without an audit pass) actually told anyone anything —
-- a probation review sat silently on My Team until a manager happened to
-- visit, and a mid-year check-in appeared for an employee with zero
-- explanation. Adds two more manager/employee alert emails, same
-- customizable-via-org-settings pattern as hire_to_onboarding_manager_alert
-- and high_potential_manager_alert. Same named-constraint widening pattern
-- 0107/0110/0115 established specifically so this never needs to guess a
-- Postgres-generated constraint name.

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
    'knowledge_hub_content_updated', 'probation_review_ready_alert',
    'midyear_checkin_scheduled_alert'
  ));

-- ============================================================
-- 0125_org_chart_annotations.sql
-- ============================================================
-- 0125: Org Chart free-floating text notes — persisted separately from
-- org_chart_saved_views on purpose. That table's own migration (0105)
-- documents it stores ONLY toggle/density/filter/preset config and
-- explicitly NEVER raw node x/y positions, since the tidy-tree layout is
-- always recomputed at render time. A note's x/y IS its actual content
-- (where you dropped it), not layout geometry to recompute, so it needs a
-- home that doesn't carry that "never positions" invariant.
--
-- One row per org (organization_id is the primary key, not a separate uuid
-- id) — there is exactly one always-on notes layer per company, shown
-- regardless of which saved view/department filter is currently active,
-- not a per-view thing. Same "org-wide, admin-authored, member-readable"
-- visibility posture as org_chart_saved_views (0105).

create table if not exists public.org_chart_annotations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  -- Array of { id: string, text: string, x: number, y: number }. Validated
  -- in TypeScript (lib/orgChart/cardConfig.ts's OrgChartAnnotation), not in
  -- Postgres — same posture as every other config-shaped jsonb column in
  -- this schema.
  annotations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.org_chart_annotations enable row level security;

drop policy if exists "Org admins can manage org chart annotations" on public.org_chart_annotations;
create policy "Org admins can manage org chart annotations"
  on public.org_chart_annotations for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart annotations" on public.org_chart_annotations;
create policy "Org members can view org chart annotations"
  on public.org_chart_annotations for select
  using (public.is_org_member(organization_id));

-- ============================================================
-- 0126_manager_action_reminders.sql
-- ============================================================
-- 0126: Manager-action reminders (process-delay audit follow-up, 2026-08-18)
--
-- A process-delay audit found that close_review blocks a cycle from
-- closing until the manager_assessment step is submitted, and
-- getMyCurrentReview hides any probation review until the hiring manager
-- calls accept_probation_review — but nothing ever reminded the MANAGER
-- about either. Only the employee's self-assessment had a reminder
-- (due_performance_review_reminders, migration 0101). A review can
-- therefore stall silently for weeks with no one nudged and no admin
-- visibility. This migration adds one reminder function covering both
-- stall points (they're mutually exclusive per review, so one function
-- with a `kind` discriminator avoids near-duplicate SQL), with an
-- admin-fallback recipient for the case where the employee's manager_user_id
-- is unset (e.g. the manager left) — otherwise that case had NO possible
-- recipient at all.
--
-- Also fixes an adjacent bug this audit surfaced in due_performance_review_
-- reminders itself: it reminds the EMPLOYEE about an unstarted self-
-- assessment based only on cyc.status = 'open' and r.status = 'not_started'
-- — it never checked whether the review is still gated behind hiring-
-- manager acceptance (getMyCurrentReview would hide it from them entirely,
-- so the email would point at something they can't open) or whether the
-- review's own step list even HAS a self_assessment step (probation
-- reviews never do — submit_manager_assessment is the only step-0 action,
-- so r.status stays 'not_started' indefinitely regardless, and the old
-- query would eventually email the new hire to "start your self-
-- reflection" for a workflow that has none).

alter table public.performance_reviews
  add column if not exists last_manager_reminder_sent_at timestamptz;

-- Same named-constraint widen pattern as 0107/0110/0115/0124 — this
-- constraint has had an explicit, stable name since 0101, so no need to
-- look it up via information_schema.
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
    'knowledge_hub_content_updated', 'probation_review_ready_alert',
    'midyear_checkin_scheduled_alert', 'manager_assessment_reminder',
    'probation_acceptance_reminder'
  ));

create or replace function public.due_manager_action_reminders(secret text)
returns table(
  review_id uuid,
  recipient_user_id uuid,
  email text,
  full_name text,
  employee_name text,
  cycle_name text,
  kind text,
  is_fallback_admin boolean,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
stable
as $$
  with candidates as (
    select
      r.id as review_id,
      r.organization_id,
      cyc.name as cycle_name,
      emp_p.full_name as employee_name,
      om.manager_user_id,
      coalesce(
        om.manager_user_id,
        (select om2.user_id from public.organization_members om2
         where om2.organization_id = r.organization_id and om2.role = 'admin' limit 1)
      ) as recipient_user_id,
      case
        when r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null
          then 'accept_probation'
        else 'submit_assessment'
      end as kind
    from public.performance_reviews r
    join public.performance_review_cycles cyc on cyc.id = r.cycle_id
    join public.organization_members om on om.user_id = r.employee_user_id
    join public.profiles emp_p on emp_p.id = r.employee_user_id
    where secret = (select value from public.app_secrets where key = 'cron_secret')
      and cyc.status = 'open'
      and (r.last_manager_reminder_sent_at is null or r.last_manager_reminder_sent_at < now() - interval '7 days')
      and (
        (r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null)
        or (
          not (r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null)
          and exists (
            select 1 from public.performance_review_instance_steps s
            where s.review_id = r.id and s.step_type = 'manager_assessment'
          )
          and not exists (
            select 1 from public.performance_review_manager_assessments ma
            where ma.review_id = r.id and ma.submitted_at is not null
          )
        )
      )
  )
  select c.review_id, c.recipient_user_id, p.email, p.full_name, c.employee_name, c.cycle_name,
         c.kind, (c.manager_user_id is null) as is_fallback_admin,
         oem.custom_subject, oem.custom_message
  from candidates c
  join public.profiles p on p.id = c.recipient_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = c.organization_id
   and oem.email_type = (case c.kind when 'accept_probation' then 'probation_acceptance_reminder' else 'manager_assessment_reminder' end)
  where p.email is not null;
$$;

revoke all on function public.due_manager_action_reminders(text) from public;
grant execute on function public.due_manager_action_reminders(text) to anon, authenticated;

create or replace function public.mark_manager_action_reminder_sent(secret text, target_review_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.performance_reviews set last_manager_reminder_sent_at = now()
  where id = target_review_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_manager_action_reminder_sent(text, uuid) from public;
grant execute on function public.mark_manager_action_reminder_sent(text, uuid) to anon, authenticated;

-- Bugfix (see header): exclude acceptance-gated reviews the employee can't
-- even see yet, and only fire for reviews whose own step list actually
-- includes self_assessment (or has zero instance steps at all — same safe
-- fallback close_review already uses for manager_assessment).
create or replace function public.due_performance_review_reminders(secret text)
returns table(
  review_id uuid,
  employee_user_id uuid,
  email text,
  full_name text,
  cycle_name text,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.employee_user_id, p.email, p.full_name, cyc.name,
    oem.custom_subject, oem.custom_message
  from public.performance_reviews r
  join public.performance_review_cycles cyc on cyc.id = r.cycle_id
  join public.profiles p on p.id = r.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = r.organization_id and oem.email_type = 'performance_review_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and cyc.status = 'open'
    and r.status = 'not_started'
    and p.email is not null
    and not (r.requires_hiring_manager_acceptance and r.hiring_manager_accepted_at is null)
    and (
      not exists (select 1 from public.performance_review_instance_steps s where s.review_id = r.id)
      or exists (
        select 1 from public.performance_review_instance_steps s
        where s.review_id = r.id and s.step_type = 'self_assessment'
      )
    )
    and (r.last_reminder_sent_at is null or r.last_reminder_sent_at < now() - interval '7 days');
$$;

revoke all on function public.due_performance_review_reminders(text) from public;
grant execute on function public.due_performance_review_reminders(text) to anon, authenticated;
