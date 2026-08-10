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
