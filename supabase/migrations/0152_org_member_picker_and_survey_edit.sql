-- Two small, independent SECURITY DEFINER RPCs, bundled in one migration:
--
-- 1. list_org_members_for_assignment — fixes a real bug found during an
--    audit: the custom performance-review step assignee picker
--    (lib/performanceReviews/workflowActions.ts's
--    listOrganizationMembersForAssignment) queries `profiles` directly,
--    whose SELECT RLS only allows own-profile / org-admin-sees-all /
--    manager-sees-direct-reports-only — so a non-admin manager picking a
--    peer or executive (exactly who this picker exists for) gets nothing
--    back for anyone outside their own direct reports. This RPC returns
--    only name+email (already visible org-wide via several other pickers
--    in this app) for any real member of the caller's own org.
--
-- 2. update_survey_if_unanswered — lets an admin edit a survey's
--    title/theme/questions, but only ever atomically: the "no responses
--    yet" check and the write happen in one statement, so there's no
--    check-then-write race where a response landing in between could let
--    an edit through after real (now-orphaned) response data exists.

create or replace function public.list_org_members_for_assignment(p_organization_id uuid)
returns table(user_id uuid, full_name text, email text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_org_member(p_organization_id) then
    return;
  end if;
  return query
    select p.id, p.full_name, p.email
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.organization_id = p_organization_id;
exception when others then
  return;
end;
$$;

revoke all on function public.list_org_members_for_assignment(uuid) from public;
grant execute on function public.list_org_members_for_assignment(uuid) to authenticated;

create or replace function public.update_survey_if_unanswered(
  p_survey_id uuid,
  p_title text,
  p_theme text,
  p_questions jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.surveys where id = p_survey_id;
  if v_org is null or not public.is_org_admin(v_org) then
    return false;
  end if;

  update public.surveys
  set title = p_title, theme = p_theme, questions = p_questions
  where id = p_survey_id
    and not exists (select 1 from public.survey_responses where survey_id = p_survey_id);

  return found;
exception when others then
  return false;
end;
$$;

revoke all on function public.update_survey_if_unanswered(uuid, text, text, jsonb) from public;
grant execute on function public.update_survey_if_unanswered(uuid, text, text, jsonb) to authenticated;
