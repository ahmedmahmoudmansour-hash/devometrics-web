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
