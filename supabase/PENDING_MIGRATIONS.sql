-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0177, 0178
--
-- Everything through 0176 confirmed applied (verified live, 2026-09-24).
--
-- 0177 -- Real gap found via live testing of 0174 (leave type eligibility):
--        only the UI honored it. An employee NOT on a restricted type's
--        grant list could POST a request for it straight to the REST API
--        and get a 201, because the leave_requests INSERT policy never
--        looked at the leave type. Adds a never-throwing helper
--        (can_request_leave_type) and one extra condition on the
--        employee-facing branches of the INSERT/UPDATE policies. The
--        org-admin branch is untouched (HR can still record leave outside
--        eligibility as a deliberate exception). Cancelling is always
--        allowed even if eligibility was later revoked.
--
-- 0178 -- Fixes get_overdue_assignments (0128) and
--        get_hiring_attention_summary (0140), which both raised Postgres
--        0A000 "invalid UNION/INTERSECT/EXCEPT ORDER BY clause" at call time
--        (their final `order by due_date` / `order by days` named a column
--        that isn't a result column of the union, since the first select
--        left it unaliased). Company-admin overdue-assignments and
--        hiring-attention widgets silently returned nothing. Redefines both
--        with create or replace (same signatures/return types/behavior),
--        wrapping the union in a subquery. Independent of 0177; order
--        between them doesn't matter.
-- ============================================================

create or replace function public.can_request_leave_type(p_leave_type_id uuid, p_employee_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.leave_types lt
    where lt.id = p_leave_type_id
      and (
        lt.eligibility <> 'restricted'
        or exists (
          select 1 from public.leave_type_eligibility e
          where e.leave_type_id = lt.id and e.employee_user_id = p_employee_user_id
        )
      )
  );
$$;

revoke all on function public.can_request_leave_type(uuid, uuid) from public;
grant execute on function public.can_request_leave_type(uuid, uuid) to authenticated;

drop policy if exists "Employees request their own leave" on public.leave_requests;
create policy "Employees request their own leave"
  on public.leave_requests for insert
  with check (
    (
      employee_user_id = auth.uid()
      and status = 'pending'
      and public.is_org_member(organization_id)
      and public.can_request_leave_type(leave_type_id, employee_user_id)
    )
    or public.is_org_admin(organization_id)
  );

drop policy if exists "Employees edit or cancel their own pending/approved leave" on public.leave_requests;
create policy "Employees edit or cancel their own pending/approved leave"
  on public.leave_requests for update
  using (employee_user_id = auth.uid())
  with check (
    employee_user_id = auth.uid()
    and status in ('pending', 'cancelled')
    and public.is_org_member(organization_id)
    and (status = 'cancelled' or public.can_request_leave_type(leave_type_id, employee_user_id))
  );

-- ============================================================
-- 0178: fix union ORDER BY in get_overdue_assignments / get_hiring_attention_summary
-- ============================================================

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
    select u.employee_user_id, u.employee_name, u.category, u.title, u.due_date
    from (
      select m.employee_user_id as employee_user_id, p.full_name as employee_name,
             'milestone'::text as category, m.title as title, m.target_date as due_date
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
    ) u
    order by u.due_date asc
    limit 50;
end;
$$;

revoke all on function public.get_overdue_assignments(uuid) from public;
grant execute on function public.get_overdue_assignments(uuid) to authenticated;

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
    select u.category, u.candidate_id, u.candidate_name, u.posting_id, u.posting_title, u.days
    from (
      select 'stale_candidate'::text as category, c.id as candidate_id, c.full_name as candidate_name,
             c.posting_id as posting_id, p.title as posting_title,
             floor(extract(epoch from (now() - c.updated_at)) / 86400)::integer as days
      from public.hiring_candidates c
      join public.job_postings p on p.id = c.posting_id
      where c.organization_id = target_organization_id
        and c.stage in ('applied', 'phone_screen', 'interview', 'offer')
        and c.updated_at < now() - interval '14 days'

      union all

      select 'dead_posting'::text, null::uuid, null::text, p.id, p.title,
             floor(extract(epoch from (now() - p.created_at)) / 86400)::integer
      from public.job_postings p
      where p.organization_id = target_organization_id
        and p.status = 'open'
        and p.created_at < now() - interval '30 days'
        and not exists (select 1 from public.hiring_candidates c2 where c2.posting_id = p.id)
    ) u
    order by u.days desc
    limit 50;
end;
$$;

revoke all on function public.get_hiring_attention_summary(uuid) from public;
grant execute on function public.get_hiring_attention_summary(uuid) to authenticated;
