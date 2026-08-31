-- Arabic i18n completeness fix, enterprise/admin audit (2026-08-28).
--
-- create_automated_review_cycle (migration 0122) hardcodes its workflow
-- step titles in English regardless of the employee's language -- unlike
-- the manual "create cycle from a starter" path (cloneStarterTemplate /
-- getOrCreateDefaultWorkflowTemplate, lib/performanceReviews/
-- workflowActions.ts + starterTemplates.ts, fixed in the same pass this
-- migration ships with), which now resolves the caller's locale before
-- picking a title. This SQL path serves the automated triggers (new-hire
-- probation, low-manager-rating mid-year check-in) and was left storing
-- permanent English step titles for an Arabic-speaking org's employee.
--
-- Locale source: the target employee's own profiles.language (there's no
-- request cookie inside a SECURITY DEFINER RPC to read), same "unknown/
-- unsupported -> en" fallback as resolveApiLocale (lib/i18n/request.ts).
-- Title strings below are the exact Arabic pairs added to starterTemplates.
-- ts's TITLE_AR/DESCRIPTION_AR dictionary, kept in lockstep per migration
-- 0122's own header note.
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
  v_locale text;
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

  select language into v_locale
  from public.profiles
  where id = p_employee_user_id;
  if v_locale is distinct from 'ar' then
    v_locale := 'en';
  end if;

  insert into public.performance_review_workflow_templates (organization_id, name, is_default)
  values (v_org_id, coalesce(nullif(trim(p_cycle_name), ''), p_starter_key) || ' Template', false)
  returning id into v_template_id;

  if p_starter_key = 'probation_review' then
    insert into public.performance_review_workflow_steps (template_id, position, step_type, title, data)
    values
      (v_template_id, 0, 'manager_assessment',
        case v_locale when 'ar' then 'تقييم فترة التجربة' else 'Probation Assessment' end, '{}'::jsonb),
      (v_template_id, 1, 'custom',
        case v_locale when 'ar' then 'مراجعة الموارد البشرية' else 'HR Review' end,
        '{"custom_kind":"hr_review","response_shape":"approval","multi_respondent":false,"min_respondents":null,"max_respondents":null,"assignment":{"mode":"role","role":"org_admin"},"anonymize_to_employee":false,"ai_assist_enabled":true}'::jsonb),
      (v_template_id, 2, 'conclusion',
        case v_locale when 'ar' then 'النتيجة' else 'Outcome' end, '{}'::jsonb);
  else -- mid_year_checkin
    insert into public.performance_review_workflow_steps (template_id, position, step_type, title, data)
    values
      (v_template_id, 0, 'self_assessment',
        case v_locale when 'ar' then 'التقييم الذاتي' else 'Self-Reflection' end, '{}'::jsonb),
      (v_template_id, 1, 'goals',
        case v_locale when 'ar' then 'الأهداف والتقدم' else 'Goals & Progress' end, '{}'::jsonb),
      (v_template_id, 2, 'manager_assessment',
        case v_locale when 'ar' then 'منظور المدير' else 'Manager''s Perspective' end, '{}'::jsonb),
      (v_template_id, 3, 'conclusion',
        case v_locale when 'ar' then 'الخلاصة' else 'Conclusion' end, '{}'::jsonb);
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
  -- migration 0122's header comment) rather than calling that function
  -- directly.
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
