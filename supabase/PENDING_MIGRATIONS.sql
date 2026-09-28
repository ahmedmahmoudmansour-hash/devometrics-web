-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0185
--
-- Everything through 0184 is applied and verified live (2026-09-28).
--
-- 0185 -- Two fixes to performance-review RPCs:
--   1. Self-approval guard (submit_manager_assessment, close_review,
--      set_competency_rating), closing the same conflict-of-interest gap
--      0168 already fixed for leave and compensation. Blocks an org
--      admin from deciding their own review ONLY when another org admin
--      exists to do it instead.
--   2. CONFIRMED LIVE BUG: submit_manager_assessment still wrote to
--      organization_members.performance_rating, dropped by migration
--      0176. Every manager-assessment submission on every review, for
--      every org, has been failing since 0176 was applied -- confirmed
--      against the live database. This is the priority half of 0185;
--      please run it as soon as you can.
-- ============================================================

create or replace function public.submit_manager_assessment(
  target_review_id uuid,
  p_rating integer,
  p_feedback text,
  p_development_needs text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_member_id uuid;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  if v_employee = auth.uid() and exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and role = 'admin' and user_id <> auth.uid()
  ) then
    raise exception 'You cannot submit your own manager assessment while another admin is available — ask them instead';
  end if;

  insert into public.performance_review_manager_assessments (review_id, reviewer_user_id, rating, feedback, development_needs, submitted_at)
  values (target_review_id, auth.uid(), p_rating, p_feedback, p_development_needs, now())
  on conflict (review_id) do update
    set reviewer_user_id = auth.uid(), rating = excluded.rating, feedback = excluded.feedback,
        development_needs = excluded.development_needs, submitted_at = now(), updated_at = now();

  update public.performance_reviews set status = 'manager_submitted' where id = target_review_id;

  -- organization_members.performance_rating no longer exists (0176) --
  -- write to its replacement instead. (organization_id, user_id) is
  -- unique per 0049, so this lookup is safe without a multi-row guard.
  select id into v_member_id from public.organization_members
  where organization_id = v_org_id and user_id = v_employee limit 1;
  if v_member_id is not null then
    insert into public.organization_member_performance (organization_id, member_id, employee_user_id, rating, note, updated_at, updated_by)
    values (v_org_id, v_member_id, v_employee, p_rating, coalesce(p_feedback, ''), now(), auth.uid())
    on conflict (member_id) do update
      set rating = excluded.rating, note = excluded.note, updated_at = now(), updated_by = excluded.updated_by;
  end if;

  update public.performance_review_instance_steps
    set submitted_at = now()
    where review_id = target_review_id and step_type = 'manager_assessment';
end;
$$;

revoke all on function public.submit_manager_assessment(uuid, integer, text, text) from public;
grant execute on function public.submit_manager_assessment(uuid, integer, text, text) to authenticated;

create or replace function public.close_review(target_review_id uuid, p_conclusion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_has_any_steps boolean;
  v_requires_manager_assessment boolean;
  v_has_manager_assessment boolean;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  if v_employee = auth.uid() and exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and role = 'admin' and user_id <> auth.uid()
  ) then
    raise exception 'You cannot close your own review while another admin is available — ask them instead';
  end if;

  select exists (
    select 1 from public.performance_review_instance_steps where review_id = target_review_id
  ) into v_has_any_steps;

  if not v_has_any_steps then
    v_requires_manager_assessment := true;
  else
    select exists (
      select 1 from public.performance_review_instance_steps
      where review_id = target_review_id and step_type = 'manager_assessment'
    ) into v_requires_manager_assessment;
  end if;

  if v_requires_manager_assessment then
    select exists (
      select 1 from public.performance_review_manager_assessments
      where review_id = target_review_id and submitted_at is not null
    ) into v_has_manager_assessment;
    if not v_has_manager_assessment then
      raise exception 'Submit the Manager''s Perspective before closing the cycle';
    end if;
  end if;

  update public.performance_reviews
    set conclusion = p_conclusion, manager_closed_at = now(), manager_closed_by = auth.uid(), status = 'closed'
    where id = target_review_id;

  update public.performance_review_instance_steps
    set submitted_at = now()
    where review_id = target_review_id and step_type = 'conclusion';
end;
$$;

revoke all on function public.close_review(uuid, text) from public;
grant execute on function public.close_review(uuid, text) to authenticated;

create or replace function public.set_competency_rating(
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
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  if v_employee = auth.uid() and exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and role = 'admin' and user_id <> auth.uid()
  ) then
    raise exception 'You cannot rate your own competencies while another admin is available — ask them instead';
  end if;

  if p_organization_competency_id is not null then
    select mapped_dimension into v_mapped_dimension
    from public.organization_competencies
    where id = p_organization_competency_id and organization_id = v_org_id;
    if not found then
      raise exception 'Invalid competency';
    end if;

    insert into public.performance_review_competency_ratings (review_id, organization_competency_id, dimension, rating, note)
    values (target_review_id, p_organization_competency_id, v_mapped_dimension, p_rating, p_note)
    on conflict (review_id, organization_competency_id) where organization_competency_id is not null
    do update set rating = excluded.rating, note = excluded.note, dimension = excluded.dimension;
  else
    insert into public.performance_review_competency_ratings (review_id, dimension, rating, note)
    values (target_review_id, p_dimension, p_rating, p_note)
    on conflict (review_id, dimension) where organization_competency_id is null
    do update set rating = excluded.rating, note = excluded.note;
  end if;
end;
$$;

revoke all on function public.set_competency_rating(uuid, text, integer, text, uuid) from public;
grant execute on function public.set_competency_rating(uuid, text, integer, text, uuid) to authenticated;
