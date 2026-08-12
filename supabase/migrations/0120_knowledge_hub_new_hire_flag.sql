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
