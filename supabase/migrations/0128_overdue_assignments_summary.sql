-- 0128: Org-wide overdue assignments summary
--
-- Process-delay audit follow-up: overdue milestones, assessments, and
-- Knowledge Hub content each already have their own per-employee reminder
-- email, but there was no aggregate view anywhere — an admin had to open
-- each employee's own page one at a time to see what's overdue for them.
-- This adds a single read-only RPC combining all three, gated by
-- is_org_admin (a live authenticated-caller check, not the cron-secret
-- pattern the reminder functions use, since this is called from the
-- Employees page, not a cron job). Reuses the exact same "is this actually
-- complete" logic each category's own due_*_reminders function already
-- established (dual-path assessment completion, milestone.completed,
-- knowledge_hub_completions) rather than inventing a second definition of
-- "overdue" that could silently drift from what the reminder emails mean.
--
-- plpgsql (not plain sql) only because of the explicit is_org_admin guard
-- at the top — this is a directly-called RPC, not a helper invoked from
-- inside another table's RLS policy, so raising an exception on an
-- unauthorized caller is the normal, intended behavior here (same posture
-- as reset_org_chart), not the "must never throw" RLS-helper case.

create or replace function public.get_overdue_assignments(target_organization_id uuid)
returns table(
  employee_user_id uuid,
  employee_name text,
  category text,
  title text,
  due_date date
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
    select m.employee_user_id, p.full_name, 'milestone'::text, m.title, m.target_date
    from (
      select dp.user_id as employee_user_id, mi.title, mi.target_date
      from public.milestones mi
      join public.development_plans dp on dp.id = mi.plan_id
      where mi.completed = false and mi.target_date is not null and mi.target_date < current_date
    ) m
    join public.profiles p on p.id = m.employee_user_id
    join public.organization_members om on om.user_id = m.employee_user_id and om.organization_id = target_organization_id

    union all

    select a.employee_user_id, p.full_name, 'assessment'::text, a.assessment_slug, a.due_date
    from public.assigned_assessments a
    join public.profiles p on p.id = a.employee_user_id
    join public.organization_members om on om.user_id = a.employee_user_id and om.organization_id = target_organization_id
    where a.due_date is not null and a.due_date < current_date
      and not exists (
        select 1 from public.assessment_results res
        where res.user_id = a.employee_user_id and res.assessment_slug = a.assessment_slug
      )
      and not exists (
        select 1 from public.case_study_exercise_attempts att
        where att.user_id = a.employee_user_id and att.exercise_slug = a.assessment_slug and att.submitted_at is not null
      )

    union all

    select ka.employee_user_id, p.full_name, 'knowledgeHub'::text, c.title, c.due_date
    from public.knowledge_hub_assignments ka
    join public.knowledge_hub_content c on c.id = ka.content_id and c.archived_at is null
    join public.profiles p on p.id = ka.employee_user_id
    join public.organization_members om on om.user_id = ka.employee_user_id and om.organization_id = target_organization_id
    where c.due_date is not null and c.due_date < current_date
      and not exists (
        select 1 from public.knowledge_hub_completions comp
        where comp.content_id = ka.content_id and comp.employee_user_id = ka.employee_user_id
      )

    order by due_date asc
    limit 50;
end;
$$;

revoke all on function public.get_overdue_assignments(uuid) from public;
grant execute on function public.get_overdue_assignments(uuid) to authenticated;
