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
