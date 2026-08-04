-- 0109: Scope a performance review cycle to specific employees
--
-- ensure_reviews_for_cycle (0076, redefined 0103) has always unconditionally
-- seeded a review for EVERY member of the organization — there was no "who
-- is this cycle for" concept anywhere in the schema. That's exactly right
-- for a company-wide annual cycle, but wrong for something like a
-- single-person probation review, which would otherwise silently create a
-- probation review for the entire workforce.
--
-- Opt-in, fully backward-compatible: a cycle with zero rows in the new
-- performance_review_cycle_participants table behaves byte-for-byte
-- identically to today (seeds the whole org) — every existing cycle and the
-- common whole-company case need no change at all. A cycle WITH participant
-- rows only seeds reviews for those specific employees. Scope is fixed at
-- creation time only in this pass — no editing an already-running cycle's
-- participant list.

create table if not exists public.performance_review_cycle_participants (
  cycle_id uuid not null references public.performance_review_cycles(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  primary key (cycle_id, employee_user_id)
);

alter table public.performance_review_cycle_participants enable row level security;

-- Admin-only in both directions — nothing employee-facing ever reads this
-- table, it's purely an admin-set creation parameter consumed inside the
-- SECURITY DEFINER ensure_reviews_for_cycle below.
drop policy if exists "Org admins can manage cycle participants" on public.performance_review_cycle_participants;
create policy "Org admins can manage cycle participants"
  on public.performance_review_cycle_participants for all
  using (exists (
    select 1 from public.performance_review_cycles c
    where c.id = performance_review_cycle_participants.cycle_id and public.is_org_admin(c.organization_id)
  ))
  with check (exists (
    select 1 from public.performance_review_cycles c
    where c.id = performance_review_cycle_participants.cycle_id and public.is_org_admin(c.organization_id)
  ));

-- Identical to the 0103 version (template resolution, instance-step
-- snapshot, resolve_custom_step_role_assignments tail) except the seeding
-- insert now respects a participant scope when one exists.
create or replace function public.ensure_reviews_for_cycle(target_cycle_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_count integer;
  v_template_id uuid;
  v_review_id uuid;
  v_has_participants boolean;
begin
  select organization_id into v_org_id from public.performance_review_cycles where id = target_cycle_id;
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'Not authorized';
  end if;

  select exists(
    select 1 from public.performance_review_cycle_participants where cycle_id = target_cycle_id
  ) into v_has_participants;

  insert into public.performance_reviews (cycle_id, organization_id, employee_user_id)
  select target_cycle_id, v_org_id, m.user_id
  from public.organization_members m
  where m.organization_id = v_org_id
    and (
      not v_has_participants
      or exists (
        select 1 from public.performance_review_cycle_participants p
        where p.cycle_id = target_cycle_id and p.employee_user_id = m.user_id
      )
    )
  on conflict (cycle_id, employee_user_id) do nothing;

  get diagnostics v_count = row_count;

  select workflow_template_id into v_template_id
  from public.performance_review_cycles where id = target_cycle_id;

  if v_template_id is null then
    select id into v_template_id
    from public.performance_review_workflow_templates
    where organization_id = v_org_id and is_default = true
    limit 1;
  end if;

  if v_template_id is not null then
    for v_review_id in
      select r.id from public.performance_reviews r
      where r.cycle_id = target_cycle_id
        and not exists (select 1 from public.performance_review_instance_steps s where s.review_id = r.id)
    loop
      insert into public.performance_review_instance_steps (review_id, workflow_step_id, position, step_type, title, description, data)
      select v_review_id, ws.id, ws.position, ws.step_type, ws.title, ws.description, ws.data
      from public.performance_review_workflow_steps ws
      where ws.template_id = v_template_id
      order by ws.position;

      perform public.resolve_custom_step_role_assignments(v_review_id);
    end loop;
  end if;

  return v_count;
end;
$$;

revoke all on function public.ensure_reviews_for_cycle(uuid) from public;
grant execute on function public.ensure_reviews_for_cycle(uuid) to authenticated;
