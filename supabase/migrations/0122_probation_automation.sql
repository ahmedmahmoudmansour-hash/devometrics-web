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
