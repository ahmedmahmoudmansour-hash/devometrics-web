-- Closes a real gap surfaced while building Impact Cycles: "manager" in
-- this app only ever meant "org admin" (organization_members.role is
-- 'admin'/'member', nothing else). A real reporting-line manager
-- (manager_user_id, set via the Org Chart — migration 0072) who is NOT an
-- org admin had zero ability to actually conduct their own direct report's
-- Impact Cycle — only HR admins could. That's backwards for any company
-- with real management layers.
--
-- This does NOT introduce a new organization_members.role value — it's a
-- relationship-based permission (is_manager_of_user), scoped strictly to
-- someone's own direct reports via the existing manager_user_id column, not
-- a broader "manager" role with organization-wide reach. A manager who
-- isn't an admin still can't create cycles, see the whole org roster, or
-- touch anyone who isn't their own report — that stays admin-only.

create or replace function public.is_manager_of_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where user_id = target_user_id and manager_user_id = auth.uid()
  );
$$;

revoke all on function public.is_manager_of_user(uuid) from public;
grant execute on function public.is_manager_of_user(uuid) to authenticated;

-- profiles: a manager needs their direct reports' name/avatar to render
-- "My Team" at all — same shape as the existing org-admin profiles policy
-- (0016), just scoped to direct reports instead of the whole org.
drop policy if exists "Managers can view their direct reports' profiles" on public.profiles;
create policy "Managers can view their direct reports' profiles"
  on public.profiles for select
  using (public.is_manager_of_user(id));

drop policy if exists "Managers can view their direct reports' reviews" on public.performance_reviews;
create policy "Managers can view their direct reports' reviews"
  on public.performance_reviews for select
  using (public.is_manager_of_user(employee_user_id));

drop policy if exists "Managers view direct reports' self-assessments" on public.performance_review_self_assessments;
create policy "Managers view direct reports' self-assessments"
  on public.performance_review_self_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

drop policy if exists "Managers view direct reports' manager-assessments" on public.performance_review_manager_assessments;
create policy "Managers view direct reports' manager-assessments"
  on public.performance_review_manager_assessments for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

-- Goals need full manage (not just view) for a manager — they're the one
-- actually setting Focus Areas for their own report, same as an admin would.
drop policy if exists "Managers manage direct reports' review goals" on public.performance_review_goals;
create policy "Managers manage direct reports' review goals"
  on public.performance_review_goals for all
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  )
  with check (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

drop policy if exists "Managers view direct reports' competency ratings" on public.performance_review_competency_ratings;
create policy "Managers view direct reports' competency ratings"
  on public.performance_review_competency_ratings for select
  using (
    exists (
      select 1 from public.performance_reviews r
      where r.id = review_id and public.is_manager_of_user(r.employee_user_id)
    )
  );

-- The three write-gated functions (0076/0077) checked is_org_admin only —
-- widened to accept "the caller is this specific employee's manager" too,
-- without loosening anything else about them (still can't touch someone
-- who isn't their report or an org admin's).
create or replace function public.submit_manager_assessment(target_review_id uuid, p_rating integer, p_feedback text)
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

  insert into public.performance_review_manager_assessments (review_id, reviewer_user_id, rating, feedback, submitted_at)
  values (target_review_id, auth.uid(), p_rating, p_feedback, now())
  on conflict (review_id) do update
    set reviewer_user_id = auth.uid(), rating = excluded.rating, feedback = excluded.feedback,
        submitted_at = now(), updated_at = now();

  update public.performance_reviews set status = 'manager_submitted' where id = target_review_id;

  update public.organization_members
    set performance_rating = p_rating,
        performance_rating_note = p_feedback,
        performance_rating_updated_at = now()
    where organization_id = v_org_id and user_id = v_employee;
end;
$$;

revoke all on function public.submit_manager_assessment(uuid, integer, text) from public;
grant execute on function public.submit_manager_assessment(uuid, integer, text) to authenticated;

create or replace function public.close_review(target_review_id uuid, p_conclusion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee uuid;
  v_has_manager_assessment boolean;
begin
  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = target_review_id;
  if v_org_id is null or (not public.is_org_admin(v_org_id) and not public.is_manager_of_user(v_employee)) then
    raise exception 'Not authorized';
  end if;

  select exists (
    select 1 from public.performance_review_manager_assessments
    where review_id = target_review_id and submitted_at is not null
  ) into v_has_manager_assessment;
  if not v_has_manager_assessment then
    raise exception 'Submit the Manager''s Perspective before closing the cycle';
  end if;

  update public.performance_reviews
    set conclusion = p_conclusion, manager_closed_at = now(), manager_closed_by = auth.uid(), status = 'closed'
    where id = target_review_id;
end;
$$;

revoke all on function public.close_review(uuid, text) from public;
grant execute on function public.close_review(uuid, text) to authenticated;

create or replace function public.set_competency_rating(target_review_id uuid, p_dimension text, p_rating integer, p_note text)
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

  insert into public.performance_review_competency_ratings (review_id, dimension, rating, note)
  values (target_review_id, p_dimension, p_rating, p_note)
  on conflict (review_id, dimension) do update
    set rating = excluded.rating, note = excluded.note;
end;
$$;

revoke all on function public.set_competency_rating(uuid, text, integer, text) from public;
grant execute on function public.set_competency_rating(uuid, text, integer, text) to authenticated;
