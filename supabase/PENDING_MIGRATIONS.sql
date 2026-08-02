-- ============================================================
-- DEVOMETRICS — PENDING MIGRATIONS IN ONE PASTE
-- 0089 through 0096 confirmed applied (2026-08-02) — trimmed from this
-- file. Two remain: 0097, curated workflow automation recipes (new hire
-- onboarding, low assessment score follow-up, high-potential flag to
-- manager) — a settings table (per-org toggle per recipe) and an audit
-- log table, both RLS-gated; and 0098, exit interviews + AI-assisted
-- root-cause analysis (admin-only in both directions). Both depend only
-- on 0016's is_org_admin() and the organizations/organization_members
-- tables, both from much earlier migrations than this file. 0097 and
-- 0098 don't depend on each other — order between them doesn't matter.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run.
-- ============================================================

-- ============================================================
-- 0097: Workflow automation settings + log
-- ============================================================

-- Curated pre-built automation recipes (not a generic workflow builder --
-- that's a much larger, separate project). An org admin toggles a fixed
-- catalog of "if X then Y" recipes on/off per organization; the actual
-- trigger/action logic lives in application code (lib/automations/), this
-- just stores which recipes are on and an audit log of what fired.
--
-- Every recipe's actions are constrained to what the ACTING user (whoever
-- triggered the underlying event -- often the employee themselves, not an
-- admin) can already legitimately do under existing RLS: create rows in
-- their own personal_tasks, or send an email (no RLS concept applies to
-- an outbound email). No recipe writes into another user's rows directly
-- -- this app has no service-role key, so there is no privileged bypass
-- available, and adding one just for automations would be a real new
-- attack surface. See lib/automations/engine.ts for the enforcement of
-- this rule in code.

create table if not exists public.workflow_automation_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipe_key text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (organization_id, recipe_key)
);

create table if not exists public.workflow_automation_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipe_key text not null,
  subject_user_id uuid references auth.users(id) on delete set null,
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.workflow_automation_settings enable row level security;
alter table public.workflow_automation_log enable row level security;

-- SELECT is deliberately any org member, not just admins: the actual gate
-- check (isRecipeEnabled) runs from inside the ACTING employee's own
-- request when they save an assessment result or run a Gap Analysis --
-- not from an admin session. Only mutation is admin-gated below.
drop policy if exists "Org members can view their automation settings" on public.workflow_automation_settings;
create policy "Org members can view their automation settings"
  on public.workflow_automation_settings for select
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = workflow_automation_settings.organization_id and user_id = auth.uid()
    )
  );

drop policy if exists "Org admins can change their automation settings" on public.workflow_automation_settings;
create policy "Org admins can change their automation settings"
  on public.workflow_automation_settings for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can update their automation settings" on public.workflow_automation_settings;
create policy "Org admins can update their automation settings"
  on public.workflow_automation_settings for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Read-only audit trail for admins; writes only ever happen via the
-- SECURITY DEFINER-free application code running as the triggering user
-- (e.g. an employee saving their own assessment result) -- that insert
-- policy intentionally allows any authenticated member of the org to log
-- an automation firing about themselves, not just admins, since the
-- employee is the one whose action actually triggered it.
drop policy if exists "Org admins can view their automation log" on public.workflow_automation_log;
create policy "Org admins can view their automation log"
  on public.workflow_automation_log for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org members can log an automation about themselves" on public.workflow_automation_log;
create policy "Org members can log an automation about themselves"
  on public.workflow_automation_log for insert
  with check (
    subject_user_id = auth.uid()
    and exists (
      select 1 from public.organization_members
      where organization_id = workflow_automation_log.organization_id and user_id = auth.uid()
    )
  );

create index if not exists workflow_automation_log_org_recipe_idx on public.workflow_automation_log (organization_id, recipe_key, subject_user_id, created_at desc);

-- ============================================================
-- 0098: Exit interviews + root-cause analysis
-- ============================================================

-- Exit interviews + AI-assisted root-cause analysis across an org's
-- accumulated interviews. Admin-only in both directions -- unlike
-- assessment_results or gap_analyses, an employee (current or departed)
-- never sees their own exit interview record; this is HR-internal data,
-- same posture as employee_manager_notes and performance_rating.
--
-- employee_user_id is nullable with ON DELETE SET NULL rather than
-- CASCADE: if the departed person's account is later deleted (the
-- existing self-serve data-deletion feature), the exit interview record
-- should survive as a historical HR record, not vanish with them --
-- employee_name is stored as a snapshot text field for exactly this
-- reason, not derived via a join that could go stale or disappear.
create table if not exists public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid references auth.users(id) on delete set null,
  employee_name text not null,
  department text,
  title text,
  manager_name text,
  last_day date,
  separation_type text not null default 'voluntary',
  responses jsonb not null default '[]'::jsonb,
  additional_notes text,
  conducted_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Append-only log rather than one-row-per-org upsert: each "Analyze
-- trends" run is its own record, so an admin can see how root causes and
-- flight-risk signals shifted over time, not just the latest snapshot.
create table if not exists public.exit_interview_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis jsonb not null,
  interview_count integer not null,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.exit_interviews enable row level security;
alter table public.exit_interview_analyses enable row level security;

drop policy if exists "Org admins can view exit interviews" on public.exit_interviews;
create policy "Org admins can view exit interviews"
  on public.exit_interviews for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can record exit interviews" on public.exit_interviews;
create policy "Org admins can record exit interviews"
  on public.exit_interviews for insert
  with check (public.is_org_admin(organization_id) and conducted_by = auth.uid());

drop policy if exists "Org admins can edit exit interviews" on public.exit_interviews;
create policy "Org admins can edit exit interviews"
  on public.exit_interviews for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org admins can delete exit interviews" on public.exit_interviews;
create policy "Org admins can delete exit interviews"
  on public.exit_interviews for delete
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can view exit interview analyses" on public.exit_interview_analyses;
create policy "Org admins can view exit interview analyses"
  on public.exit_interview_analyses for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins can generate exit interview analyses" on public.exit_interview_analyses;
create policy "Org admins can generate exit interview analyses"
  on public.exit_interview_analyses for insert
  with check (public.is_org_admin(organization_id) and generated_by = auth.uid());

create index if not exists exit_interviews_org_idx on public.exit_interviews (organization_id, created_at desc);
create index if not exists exit_interview_analyses_org_idx on public.exit_interview_analyses (organization_id, created_at desc);
