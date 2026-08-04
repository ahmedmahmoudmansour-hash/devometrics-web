-- 0104: Harden two gaps found in a security review of 0103's custom-step
-- framework, run right after 0103 went live.
--
-- 1. get_custom_step_completion(uuid) had NO authorization check at all —
--    any authenticated user could call it with any instance_step_id and
--    read back assignment/submission counts for a custom step on ANY
--    review in ANY organization, not just their own. Every other function
--    in 0103 checks is_org_admin/is_manager_of_user/employee ownership
--    first; this one was written as "just counts, no content, low risk"
--    and the auth check was skipped — a real cross-tenant metadata leak,
--    even though the practical exploitability is low (instance_step_id is
--    a random uuid, not enumerable). Fixed by adding the same authorization
--    check as the rest of the file, extended to also allow the step's own
--    assigned responder (who needs to see "2 of 3 submitted" on a step
--    they're actively responding to, same as the UI already assumes).
--    Rewritten from `language sql` to `language plpgsql` since the check
--    needs a conditional. An unauthorized call now returns zero rows
--    (not an exception) — matches the app's existing
--    `.maybeSingle()` -> null degrade pattern exactly.
--
-- 2. The RLS policy "Employees can view non-anonymous custom step responses
--    on their own review" did `(s.data->>'anonymize_to_employee')::boolean`
--    inline — a cast that THROWS on any non-boolean value. Per this same
--    codebase's own hardening lesson (0083's upline_level_of_user incident,
--    which broke every org's Impact Cycles roster in production because a
--    throwing expression inside an RLS USING clause aborts the ENTIRE
--    query, not just the one row), this is the exact same anti-pattern:
--    performance_review_workflow_steps.data is directly admin-writable
--    (not RPC-validated, unlike instance-step content), so a future admin
--    UI bug, a manual SQL edit, or a new feature that writes this field
--    slightly differently could silently blackout an employee's entire
--    custom-step response list with no error surfaced. Fixed by replacing
--    the cast with a plain text comparison that can never throw — only the
--    literal string 'false' turns anonymization off; anything else
--    (including malformed garbage) fails closed toward MORE privacy, which
--    is the correct default direction for this specific field.

create or replace function public.get_custom_step_completion(target_instance_step_id uuid)
returns table(assigned_count integer, submitted_count integer, min_required integer)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_review_id uuid;
  v_org_id uuid;
  v_employee uuid;
  v_authorized boolean;
begin
  select s.review_id into v_review_id
  from public.performance_review_instance_steps s
  where s.id = target_instance_step_id;
  if v_review_id is null then
    return;
  end if;

  select organization_id, employee_user_id into v_org_id, v_employee
  from public.performance_reviews where id = v_review_id;
  if v_org_id is null then
    return;
  end if;

  v_authorized :=
    v_employee = auth.uid()
    or public.is_org_admin(v_org_id)
    or public.is_manager_of_user(v_employee)
    or public.is_upline_manager_of_user(v_employee)
    or exists (
      select 1 from public.performance_review_custom_step_assignments a
      where a.instance_step_id = target_instance_step_id and a.assignee_user_id = auth.uid()
    );
  if not v_authorized then
    return;
  end if;

  return query
  select
    (select count(*)::integer from public.performance_review_custom_step_assignments where instance_step_id = target_instance_step_id),
    (select count(*)::integer from public.performance_review_custom_step_responses where instance_step_id = target_instance_step_id and submitted_at is not null),
    (select nullif(data->>'min_respondents', '')::integer from public.performance_review_instance_steps where id = target_instance_step_id);
end;
$$;

revoke all on function public.get_custom_step_completion(uuid) from public;
grant execute on function public.get_custom_step_completion(uuid) to authenticated;

drop policy if exists "Employees can view non-anonymous custom step responses on their own review" on public.performance_review_custom_step_responses;
create policy "Employees can view non-anonymous custom step responses on their own review"
  on public.performance_review_custom_step_responses for select
  using (exists (
    select 1 from public.performance_reviews r
    join public.performance_review_instance_steps s on s.id = performance_review_custom_step_responses.instance_step_id
    where r.id = performance_review_custom_step_responses.review_id
      and r.employee_user_id = auth.uid()
      and not (
        coalesce(s.data->>'custom_kind', '') in ('peer_feedback', '360_feedback')
        and coalesce(s.data->>'anonymize_to_employee', 'true') <> 'false'
      )
  ));
