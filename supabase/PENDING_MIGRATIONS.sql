-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0129 THROUGH 0141
--
-- Everything through 0128 has been confirmed applied. 0129 adds a
-- single column (is_new_hire) to organization_invites, gating whether
-- the probation-review automation auto-starts on invite acceptance.
-- 0130 and 0131 each widen the email-type constraint for one new
-- customizable alert (low assessment score -> manager notification;
-- review acknowledgment comment -> manager + admin notification).
-- 0132 adds employee self-rating on competencies (self_rating/self_note
-- columns + a new employee-only RPC), alongside the existing
-- manager rating on the same row. 0133 gives probation cycles a real
-- 90-day timeline (closes_at). 0134 widens the email-type constraint
-- for two more alerts (review reopened; Department Head Review
-- reminder). 0135 adds the Department Head Review reminder itself
-- (a new internal-only dedup table + two RPCs). 0136 adds
-- employee-initiated review escalation (escalation_requested_at/
-- escalation_comment columns + a new employee-only RPC + a third
-- customizable alert). 0137 adds a manager/admin-only "resolve" action
-- for an escalation (clears the badge without erasing the record) and
-- an org-wide "currently escalated" summary widget. 0138 makes the
-- resolution comment required (widens resolve_review_escalation's
-- signature) and notifies the employee, with that comment, when their
-- escalation is resolved.
--
-- 0139-0141 are from the Hiring/Training process-gap audit: 0139 notifies
-- candidates on the "offer" and "rejected" stages, not just "interview".
-- 0140 adds a stale-candidate/dead-posting summary (a live widget RPC +
-- a weekly digest email to admins, with its own dedup table). 0141 adds
-- a Knowledge Hub exhausted-exam-attempts admin alert and escalates a
-- severely overdue (30+ day) Knowledge Hub reminder to the assignee's
-- manager once.
--
-- Ahmed is batching these — hold off running until he confirms he's
-- ready, rather than prompting after each one.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run. If anything errors partway, copy the exact
-- error text back so it can be diagnosed rather than re-run blind.
-- ============================================================

-- ============================================================
-- 0129_invite_new_hire_flag.sql
-- ============================================================
-- 0129: Explicit is_new_hire flag on organization_invites
--
-- Both hire_to_onboarding (Knowledge Hub welcome content) and
-- hire_to_probation used to fire for EVERY invite-based join — someone
-- directly added on the Employees page got treated identically to someone
-- who actually came through the Hiring pipeline. Fine for the welcome
-- content (harmless either way), wrong for probation: an admin bulk-adding
-- existing staff to get them onto the platform would spin up a probation
-- review for every single one of them.
--
-- Per the CEO: keep welcome broad (unchanged), but probation should only
-- auto-start when there's a real signal this is a genuine new hire — either
-- (a) they came through the Hiring pipeline (candidate_id already implies
-- this), or (b) the admin explicitly marks them as one when inviting
-- directly. Default false everywhere so the safe/quiet behavior — no
-- probation review — is what happens unless someone opts in.

alter table public.organization_invites
  add column if not exists is_new_hire boolean not null default false;

-- ============================================================
-- 0130_low_score_manager_alert_email.sql
-- ============================================================
-- 0130: One more customizable automation-fired alert email
--
-- low_score_to_reassessment used to fire completely privately — only the
-- employee's own two follow-up tasks, nobody else ever notified. An
-- asymmetry with high_potential_to_succession, which already emails the
-- manager on a GOOD score. Per the CEO: add the same manager visibility
-- for a low score. Same named-constraint widening pattern as
-- 0107/0110/0115/0124/0126/0130 established specifically so this never
-- needs to guess a Postgres-generated constraint name.

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert'
  ));

-- ============================================================
-- 0131_review_acknowledgment_alert_email.sql
-- ============================================================
-- 0131: One more customizable automation-fired alert email
--
-- An employee's acknowledgment comment (e.g. disagreement with a low
-- manager rating — a manager rating is never locked, so the practical path
-- today is "raise it, the manager revises") used to sit silently in the
-- database — visible only to someone who happened to open that specific
-- review. Now routes it to both the employee's manager and an org admin.
-- Same named-constraint widening pattern as 0107/0110/0115/0124/0126/0130
-- established specifically so this never needs to guess a
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
    'midyear_checkin_scheduled_alert', 'manager_assessment_reminder',
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert'
  ));

-- ============================================================
-- 0132_self_competency_ratings.sql
-- ============================================================
-- 0132: Employee self-rating on competencies
--
-- Per the CEO, reviewing a live test run: competency ratings were
-- manager/admin only — set_competency_rating's own auth check is
-- is_org_admin OR is_manager_of_user, so the employee couldn't rate their
-- own competencies even if the UI offered it. This adds a parallel
-- self_rating/self_note pair on the existing performance_review_
-- competency_ratings row — same "one row, both authors' values side by
-- side" shape already used for the overall self-rating vs. manager-rating
-- (performance_review_self_assessments.rating vs.
-- performance_review_manager_assessments.rating) — plus a new
-- employee-only RPC to set it.
--
-- rating (the manager's) must become nullable: a row can now legitimately
-- exist with only a self_rating and no manager rating yet, if the employee
-- rates before the manager does.

alter table public.performance_review_competency_ratings
  alter column rating drop not null;

alter table public.performance_review_competency_ratings
  add column if not exists self_rating integer check (self_rating between 1 and 5),
  add column if not exists self_note text,
  add column if not exists self_submitted_at timestamptz;

-- Mirrors set_competency_rating's own shape exactly, just employee-scoped
-- (v_employee != auth.uid() rejects everyone else, including the manager
-- and org admins — this is specifically the employee's own judgment) and
-- writing to the self_* columns instead.
create or replace function public.set_self_competency_rating(
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
  if v_org_id is null or v_employee is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if p_organization_competency_id is not null then
    select mapped_dimension into v_mapped_dimension
    from public.organization_competencies
    where id = p_organization_competency_id and organization_id = v_org_id;
    if not found then
      raise exception 'Invalid competency';
    end if;

    insert into public.performance_review_competency_ratings (review_id, organization_competency_id, dimension, self_rating, self_note, self_submitted_at)
    values (target_review_id, p_organization_competency_id, v_mapped_dimension, p_rating, p_note, now())
    on conflict (review_id, organization_competency_id) where organization_competency_id is not null
    do update set self_rating = excluded.self_rating, self_note = excluded.self_note, self_submitted_at = now(), dimension = excluded.dimension;
  else
    insert into public.performance_review_competency_ratings (review_id, dimension, self_rating, self_note, self_submitted_at)
    values (target_review_id, p_dimension, p_rating, p_note, now())
    on conflict (review_id, dimension) where organization_competency_id is null
    do update set self_rating = excluded.self_rating, self_note = excluded.self_note, self_submitted_at = now();
  end if;
end;
$$;

revoke all on function public.set_self_competency_rating(uuid, text, integer, text, uuid) from public;
grant execute on function public.set_self_competency_rating(uuid, text, integer, text, uuid) to authenticated;

-- ============================================================
-- 0133_probation_timeline.sql
-- ============================================================
-- 0133: Give probation reviews a timeline
--
-- create_automated_review_cycle (0122) only ever set opens_at — never
-- closes_at — so a probation cycle had no deadline at all: it could sit at
-- "manager submitted, HR reviewing" indefinitely with no urgency signal,
-- unlike every other cycle type. Fixed at the source (this RPC) rather
-- than in a new column/table: closes_at already exists on
-- performance_review_cycles, and MyPerformanceReview/PerformanceReviewsManager
-- already render describeCycleTimeline's "closes in N days"/"overdue by N
-- days" off it — setting the column is enough to get that UI for free, no
-- new frontend code needed.
--
-- 90 days is a fixed default, not an org-configurable setting — the CEO
-- raised configurable probation length as an open question earlier this
-- program and it was deliberately left unresolved; a sensible universal
-- default ships faster than a second settings surface and can become
-- configurable later if real usage asks for it (same reasoning the
-- mid-year trigger's 2/5 threshold used). mid_year_checkin is unaffected
-- (closes_at stays null for it, exactly as before).

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
  v_closes_at date;
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

  if p_starter_key = 'probation_review' then
    v_closes_at := coalesce(p_opens_at, current_date) + interval '90 days';
  else
    v_closes_at := null;
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

  insert into public.performance_review_cycles (organization_id, name, status, created_by, opens_at, closes_at, workflow_template_id)
  values (v_org_id, coalesce(nullif(trim(p_cycle_name), ''), initcap(replace(p_starter_key, '_', ' '))), 'open', auth.uid(), p_opens_at, v_closes_at, v_template_id)
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

-- ============================================================
-- 0134_reopen_and_dept_head_alert_emails.sql
-- ============================================================
-- 0134: Two more customizable automation-fired alert emails
--
-- review_reopened_alert: submit_manager_assessment has no status guard, so
-- resubmitting a rating on a closed review silently reopens it — now
-- notifies the employee and an org admin.
-- department_head_review_reminder: the optional Department Head Review was
-- the one manager-facing step left with no recurring reminder (0126 added
-- the manager-assessment and probation-acceptance reminders, but not this
-- one) — an eligible upline manager who never signs off was never nudged.
-- The actual reminder RPCs for the second one are in 0135; this migration
-- just widens the constraint for both so 0135 doesn't need to touch it
-- again. Same named-constraint widening pattern as
-- 0107/0110/0115/0124/0126/0130/0131 established specifically so this
-- never needs to guess a Postgres-generated constraint name.

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert', 'review_reopened_alert',
    'department_head_review_reminder'
  ));

-- ============================================================
-- 0135_department_head_review_reminders.sql
-- ============================================================
-- 0135: Department Head Review reminders
--
-- Migration 0126 added recurring reminders for the manager_assessment step
-- and probation acceptance — but the optional Department Head Review
-- (level 2+ upline signoff, submit_upline_signoff) was left out. It's the
-- one manager-facing step in this app with no reminder at all: an eligible
-- upline manager who never signs off is simply never nudged.
--
-- performance_review_upline_signoffs only ever gets a row once someone
-- actually submits (see submit_upline_signoff) — there's no pre-seeded
-- "pending" row to attach a last_reminder_sent_at column to, and eligible
-- levels are computed dynamically from the org's review_escalation_levels
-- setting by walking organization_members.manager_user_id, not stored
-- anywhere. So this needs its own small dedup table (below) plus a
-- recursive CTE to walk the chain, rather than reusing
-- performance_reviews.last_manager_reminder_sent_at (0126) — that column
-- is already shared by the manager-assessment/probation-acceptance
-- reminders, and reusing it here would let this reminder suppress those or
-- vice versa, which are genuinely different recipients for different
-- steps.

-- RLS enabled with ZERO policies — deliberately unreachable via the API
-- (SELECT included) for every role including authenticated. Pure
-- cron-bookkeeping: only the SECURITY DEFINER functions below ever touch
-- it, the same posture as any other internal-only table in this schema.
create table if not exists public.performance_review_upline_reminder_log (
  review_id uuid not null references public.performance_reviews(id) on delete cascade,
  manager_user_id uuid not null,
  last_reminder_sent_at timestamptz not null default now(),
  primary key (review_id, manager_user_id)
);

alter table public.performance_review_upline_reminder_log enable row level security;

create or replace function public.due_department_head_review_reminders(secret text)
returns table(
  review_id uuid,
  recipient_user_id uuid,
  email text,
  full_name text,
  employee_name text,
  cycle_name text,
  custom_subject text,
  custom_message text
)
language sql
security definer
set search_path = public
stable
as $$
  with recursive chain as (
    -- Level 1 = the employee's direct manager, walked the same way
    -- getUplineChain (lib/performanceReviews/actions.ts) does it — level 1
    -- is excluded below since that's the ordinary manager_assessment step,
    -- already covered by 0126.
    select
      r.id as review_id,
      r.organization_id,
      r.employee_user_id,
      1 as level,
      om.manager_user_id,
      least(coalesce(o.review_escalation_levels, 1), 10) as max_level
    from public.performance_reviews r
    join public.performance_review_cycles cyc on cyc.id = r.cycle_id
    join public.organization_members om on om.user_id = r.employee_user_id and om.organization_id = r.organization_id
    join public.organizations o on o.id = r.organization_id
    where cyc.status = 'open' and om.manager_user_id is not null

    union all

    select
      c.review_id,
      c.organization_id,
      c.employee_user_id,
      c.level + 1,
      om2.manager_user_id,
      c.max_level
    from chain c
    join public.organization_members om2 on om2.user_id = c.manager_user_id and om2.organization_id = c.organization_id
    where c.level < c.max_level and om2.manager_user_id is not null
  )
  select
    c.review_id,
    c.manager_user_id,
    p.email,
    p.full_name,
    emp.full_name,
    cyc.name,
    oem.custom_subject,
    oem.custom_message
  from chain c
  join public.performance_reviews r on r.id = c.review_id
  join public.performance_review_cycles cyc on cyc.id = r.cycle_id
  join public.profiles p on p.id = c.manager_user_id
  join public.profiles emp on emp.id = c.employee_user_id
  left join public.organization_email_messages oem
    on oem.organization_id = c.organization_id and oem.email_type = 'department_head_review_reminder'
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and c.level >= 2
    and p.email is not null
    and not exists (
      select 1 from public.performance_review_upline_signoffs s
      where s.review_id = c.review_id and s.manager_user_id = c.manager_user_id and s.signed_off_at is not null
    )
    and not exists (
      select 1 from public.performance_review_upline_reminder_log l
      where l.review_id = c.review_id and l.manager_user_id = c.manager_user_id
        and l.last_reminder_sent_at > now() - interval '7 days'
    );
$$;

revoke all on function public.due_department_head_review_reminders(text) from public;
grant execute on function public.due_department_head_review_reminders(text) to anon, authenticated;

create or replace function public.mark_department_head_review_reminder_sent(secret text, target_review_id uuid, target_manager_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.performance_review_upline_reminder_log (review_id, manager_user_id, last_reminder_sent_at)
  select target_review_id, target_manager_user_id, now()
  where secret = (select value from public.app_secrets where key = 'cron_secret')
  on conflict (review_id, manager_user_id) do update set last_reminder_sent_at = now();
$$;

revoke all on function public.mark_department_head_review_reminder_sent(text, uuid, uuid) from public;
grant execute on function public.mark_department_head_review_reminder_sent(text, uuid, uuid) to anon, authenticated;

-- ============================================================
-- 0136_review_escalation.sql
-- ============================================================
-- 0136: Employee-initiated review escalation
--
-- The acknowledgment-comment alert (0131) notifies someone when an employee
-- writes something — but it's passive: there's no explicit "I disagree,
-- please have this reviewed further" action, no persistent visible status,
-- and no clear target. This adds a real escalation: an employee-only RPC
-- that stamps the review and notifies whoever's actually positioned to act
-- — an eligible upline manager (level 2+, same chain-walk 0135 already
-- computes) if one exists, an org admin either way.
--
-- Deliberately non-blocking (per the CEO): escalating doesn't gate
-- close_review or anything else — same "informational, RLS is the real
-- boundary" posture as the timeline work and everything else in this
-- schema. It's visibility, not a hard stop.

alter table public.performance_reviews
  add column if not exists escalation_requested_at timestamptz,
  add column if not exists escalation_comment text;

create or replace function public.request_review_escalation(target_review_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
begin
  select employee_user_id into v_employee from public.performance_reviews where id = target_review_id;
  if v_employee is null or v_employee is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  if coalesce(trim(p_comment), '') = '' then
    raise exception 'A comment is required to escalate';
  end if;

  update public.performance_reviews
    set escalation_requested_at = now(), escalation_comment = p_comment
    where id = target_review_id;
end;
$$;

revoke all on function public.request_review_escalation(uuid, text) from public;
grant execute on function public.request_review_escalation(uuid, text) to authenticated;

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert', 'review_reopened_alert',
    'department_head_review_reminder', 'review_escalation_requested_alert'
  ));

-- ============================================================
-- 0137_escalation_resolve_and_summary.sql
-- ============================================================
-- 0137: Resolve escalations + an org-wide escalated-reviews summary
--
-- Two follow-ups the CEO flagged right after 0136 shipped:
--
-- 1. The "Escalated" badge (0136) had no way to be cleared — once
--    escalation_requested_at was set, it showed forever, even after the
--    concern was actually addressed. Adds escalation_resolved_at/_by and a
--    manager/admin-only RPC to set them (same auth shape as
--    submit_manager_assessment: is_org_admin OR is_manager_of_user).
--
-- 2. HR had no aggregate view of how many reviews are currently escalated
--    org-wide — same gap pattern get_overdue_assignments (0128) already
--    solved for milestones/assessments/Knowledge Hub, just never extended
--    to cover this. Adds a matching read-only RPC.

alter table public.performance_reviews
  add column if not exists escalation_resolved_at timestamptz,
  add column if not exists escalation_resolved_by uuid references auth.users(id) on delete set null;

create or replace function public.resolve_review_escalation(target_review_id uuid)
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

  update public.performance_reviews
    set escalation_resolved_at = now(), escalation_resolved_by = auth.uid()
    where id = target_review_id;
end;
$$;

revoke all on function public.resolve_review_escalation(uuid) from public;
grant execute on function public.resolve_review_escalation(uuid) to authenticated;

-- Read-only, admin-gated (live authenticated-caller check, same posture as
-- get_overdue_assignments — not the cron-secret pattern, since this is
-- called from the Impact Cycles admin page, not a cron job).
create or replace function public.get_escalated_reviews(target_organization_id uuid)
returns table(
  review_id uuid,
  employee_user_id uuid,
  employee_name text,
  cycle_name text,
  escalation_requested_at timestamptz,
  escalation_comment text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(target_organization_id) then
    raise exception 'Not authorized';
  end if;

  return query
    select r.id, r.employee_user_id, p.full_name, cyc.name, r.escalation_requested_at, r.escalation_comment
    from public.performance_reviews r
    join public.performance_review_cycles cyc on cyc.id = r.cycle_id
    join public.profiles p on p.id = r.employee_user_id
    where r.organization_id = target_organization_id
      and r.escalation_requested_at is not null
      and r.escalation_resolved_at is null
    order by r.escalation_requested_at asc
    limit 50;
end;
$$;

revoke all on function public.get_escalated_reviews(uuid) from public;
grant execute on function public.get_escalated_reviews(uuid) to authenticated;

-- ============================================================
-- 0138_escalation_resolution_comment.sql
-- ============================================================
-- 0138: Require a resolution comment on "Mark resolved"
--
-- Escalating requires a comment ("why you disagree"), but resolving was a
-- bare click — no record of HOW the concern was actually addressed. Per
-- the CEO: give HR a comment field there too, for symmetry and a real
-- audit trail (escalated because X, resolved because Y). The employee is
-- notified with this comment when their escalation is resolved, but
-- doesn't have to sign off on it — informational, not a second
-- acknowledge_review loop (per the CEO's own "no need" on that point).

alter table public.performance_reviews
  add column if not exists escalation_resolution_comment text;

-- Signature changed (uuid) -> (uuid, text) — Postgres treats a different
-- parameter list as a distinct overload, not a replacement, so the old
-- single-arg version must be dropped explicitly or it'd linger unused.
drop function if exists public.resolve_review_escalation(uuid);

create or replace function public.resolve_review_escalation(target_review_id uuid, p_comment text)
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
  if coalesce(trim(p_comment), '') = '' then
    raise exception 'A comment is required to resolve an escalation';
  end if;

  update public.performance_reviews
    set escalation_resolved_at = now(), escalation_resolved_by = auth.uid(), escalation_resolution_comment = p_comment
    where id = target_review_id;
end;
$$;

revoke all on function public.resolve_review_escalation(uuid, text) from public;
grant execute on function public.resolve_review_escalation(uuid, text) to authenticated;

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert', 'review_reopened_alert',
    'department_head_review_reminder', 'review_escalation_requested_alert',
    'review_escalation_resolved_alert'
  ));

-- ============================================================
-- 0139_offer_rejected_stage_emails.sql
-- ============================================================
-- 0139: Notify candidates on offer/rejected, not just interview
--
-- Hiring/training process-gap audit (2026-08-20): moveCandidateStage only
-- ever emailed a candidate on the "interview" stage. Moving someone to
-- "offer" or "rejected" sent nothing — a rejected candidate has no
-- dashboard login to check status themselves, so they'd simply never find
-- out. Two more customizable email types, same named-constraint widening
-- pattern established since 0107.

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert', 'review_reopened_alert',
    'department_head_review_reminder', 'review_escalation_requested_alert',
    'review_escalation_resolved_alert', 'offer_stage_notice',
    'rejected_stage_notice'
  ));

-- ============================================================
-- 0140_hiring_attention_digest.sql
-- ============================================================
-- 0140: Stale-candidate / dead-posting visibility for Hiring
--
-- Hiring/training process-gap audit (2026-08-20): HiringPipelineBoard
-- already computes a 14-day staleness badge per candidate, but it's only
-- ever visible on that one posting's own board — an admin has to open
-- every open posting to notice a candidate stuck 3+ weeks in "interview,"
-- or a posting that's been open for months with zero candidates. Hiring
-- also had zero entry in the daily reminders cron, unlike every other
-- domain audited this session. Adds (a) a live admin-gated summary RPC
-- for a dashboard widget (same posture as get_overdue_assignments/
-- get_escalated_reviews) and (b) a weekly digest email to org admins,
-- with its own dedup table since this is an org-wide digest, not a
-- per-item reminder.

create table if not exists public.hiring_attention_reminder_log (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_sent_at timestamptz not null default now()
);

alter table public.hiring_attention_reminder_log enable row level security;

create or replace function public.get_hiring_attention_summary(target_organization_id uuid)
returns table(
  category text,
  candidate_id uuid,
  candidate_name text,
  posting_id uuid,
  posting_title text,
  days integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(target_organization_id) then
    raise exception 'Not authorized';
  end if;

  return query
    select 'stale_candidate'::text, c.id, c.full_name, c.posting_id, p.title,
           floor(extract(epoch from (now() - c.updated_at)) / 86400)::integer
    from public.hiring_candidates c
    join public.job_postings p on p.id = c.posting_id
    where c.organization_id = target_organization_id
      and c.stage in ('applied', 'phone_screen', 'interview', 'offer')
      and c.updated_at < now() - interval '14 days'

    union all

    select 'dead_posting'::text, null, null, p.id, p.title,
           floor(extract(epoch from (now() - p.created_at)) / 86400)::integer
    from public.job_postings p
    where p.organization_id = target_organization_id
      and p.status = 'open'
      and p.created_at < now() - interval '30 days'
      and not exists (select 1 from public.hiring_candidates c2 where c2.posting_id = p.id)

    order by days desc
    limit 50;
end;
$$;

revoke all on function public.get_hiring_attention_summary(uuid) from public;
grant execute on function public.get_hiring_attention_summary(uuid) to authenticated;

-- One row per (org, admin) needing a digest — every org admin gets it, not
-- just one (an operational "things need attention" digest, unlike the
-- single-recipient-fallback pattern used for individual review
-- notifications). Weekly cadence via hiring_attention_reminder_log, one
-- row per org.
create or replace function public.due_hiring_attention_digest(secret text)
returns table(
  organization_id uuid,
  recipient_user_id uuid,
  email text,
  full_name text,
  stale_candidate_count integer,
  dead_posting_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  with org_counts as (
    select
      o.id as organization_id,
      (
        select count(*) from public.hiring_candidates c
        where c.organization_id = o.id
          and c.stage in ('applied', 'phone_screen', 'interview', 'offer')
          and c.updated_at < now() - interval '14 days'
      ) as stale_candidate_count,
      (
        select count(*) from public.job_postings p
        where p.organization_id = o.id
          and p.status = 'open'
          and p.created_at < now() - interval '30 days'
          and not exists (select 1 from public.hiring_candidates c2 where c2.posting_id = p.id)
      ) as dead_posting_count
    from public.organizations o
  )
  select oc.organization_id, om.user_id, pr.email, pr.full_name, oc.stale_candidate_count, oc.dead_posting_count
  from org_counts oc
  join public.organization_members om on om.organization_id = oc.organization_id and om.role = 'admin'
  join public.profiles pr on pr.id = om.user_id
  left join public.hiring_attention_reminder_log l on l.organization_id = oc.organization_id
  where secret = (select value from public.app_secrets where key = 'cron_secret')
    and (oc.stale_candidate_count > 0 or oc.dead_posting_count > 0)
    and pr.email is not null
    and (l.last_sent_at is null or l.last_sent_at < now() - interval '7 days')
  order by oc.organization_id;
$$;

revoke all on function public.due_hiring_attention_digest(text) from public;
grant execute on function public.due_hiring_attention_digest(text) to anon, authenticated;

create or replace function public.mark_hiring_attention_digest_sent(secret text, target_organization_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.hiring_attention_reminder_log (organization_id, last_sent_at)
  select target_organization_id, now()
  where secret = (select value from public.app_secrets where key = 'cron_secret')
  on conflict (organization_id) do update set last_sent_at = now();
$$;

revoke all on function public.mark_hiring_attention_digest_sent(text, uuid) from public;
grant execute on function public.mark_hiring_attention_digest_sent(text, uuid) to anon, authenticated;

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert', 'review_reopened_alert',
    'department_head_review_reminder', 'review_escalation_requested_alert',
    'review_escalation_resolved_alert', 'offer_stage_notice',
    'rejected_stage_notice', 'hiring_attention_digest'
  ));

-- ============================================================
-- 0141_knowledge_hub_exhaustion_and_escalation.sql
-- ============================================================
-- 0141: Knowledge Hub — exhausted-attempts alert email + manager escalation
--
-- Hiring/training process-gap audit (2026-08-20), two Knowledge Hub gaps:
--
-- 1. submit_knowledge_hub_exam (0087) tells the employee to "contact your
--    admin" once they've used every attempt, but there was no actual way
--    to do that in-app and no admin was ever told either — someone could
--    permanently fail out of required/compliance training silently. Just
--    widens the email-type constraint here; the notification logic itself
--    lives in the TS action (submitKnowledgeHubExam), not a new RPC.
--
-- 2. due_knowledge_hub_reminders (0085/0101/0127) re-nudges only the
--    assignee, forever, on a 3-day cadence — never escalating to their
--    manager even after a severely overdue assignment (30+ days), unlike
--    the manager/department-head escalation paths already built for
--    performance reviews. Adds manager_notified_at (separate dedup from
--    last_reminder_sent_at, since this only needs to fire once, not every
--    3 days) plus manager email/name and an escalate flag in the query.

alter table public.knowledge_hub_assignments
  add column if not exists manager_notified_at timestamptz;

create or replace function public.due_knowledge_hub_reminders(secret text)
returns table(
  assignment_id uuid,
  user_id uuid,
  email text,
  full_name text,
  content_title text,
  due_date date,
  overdue boolean,
  custom_subject text,
  custom_message text,
  escalate_to_manager boolean,
  manager_user_id uuid,
  manager_email text,
  manager_full_name text
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      a.id, a.employee_user_id, a.manager_notified_at, u.email, p.full_name, c.title, c.due_date,
      coalesce(c.due_date < current_date, false) as overdue,
      org.organization_id,
      (
        (c.due_date is not null and c.due_date <= current_date - interval '30 days')
        or (c.due_date is null and c.is_new_hire_content and a.created_at <= now() - interval '30 days')
      ) as is_severely_overdue
    from public.knowledge_hub_assignments a
    join public.knowledge_hub_content c on c.id = a.content_id and c.archived_at is null
    join auth.users u on u.id = a.employee_user_id
    left join public.profiles p on p.id = u.id
    left join lateral (
      select om.organization_id from public.organization_members om where om.user_id = u.id limit 1
    ) org on true
    where secret = (select value from public.app_secrets where key = 'cron_secret')
      and u.email is not null
      and (
        (c.due_date is not null and c.due_date <= current_date + interval '7 days')
        or (c.due_date is null and c.is_new_hire_content and a.created_at <= now() - interval '7 days')
      )
      and not exists (
        select 1 from public.knowledge_hub_completions comp
        where comp.content_id = a.content_id and comp.employee_user_id = a.employee_user_id
      )
      and (a.last_reminder_sent_at is null or a.last_reminder_sent_at < now() - interval '3 days')
  )
  select
    b.id, b.employee_user_id, b.email, b.full_name, b.title, b.due_date, b.overdue,
    oem.custom_subject, oem.custom_message,
    (b.is_severely_overdue and b.manager_notified_at is null) as escalate_to_manager,
    om.manager_user_id, mp.email, mp.full_name
  from base b
  left join public.organization_email_messages oem
    on oem.organization_id = b.organization_id and oem.email_type = 'knowledge_hub_reminder'
  left join public.organization_members om on om.user_id = b.employee_user_id
  left join public.profiles mp on mp.id = om.manager_user_id;
$$;

revoke all on function public.due_knowledge_hub_reminders(text) from public;
grant execute on function public.due_knowledge_hub_reminders(text) to anon, authenticated;

create or replace function public.mark_knowledge_hub_manager_notified(secret text, target_assignment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.knowledge_hub_assignments set manager_notified_at = now()
  where id = target_assignment_id
    and secret = (select value from public.app_secrets where key = 'cron_secret');
$$;

revoke all on function public.mark_knowledge_hub_manager_notified(text, uuid) from public;
grant execute on function public.mark_knowledge_hub_manager_notified(text, uuid) to anon, authenticated;

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
    'probation_acceptance_reminder', 'low_assessment_score_manager_alert',
    'review_acknowledgment_comment_alert', 'review_reopened_alert',
    'department_head_review_reminder', 'review_escalation_requested_alert',
    'review_escalation_resolved_alert', 'offer_stage_notice',
    'rejected_stage_notice', 'hiring_attention_digest',
    'knowledge_hub_attempts_exhausted_alert'
  ));
