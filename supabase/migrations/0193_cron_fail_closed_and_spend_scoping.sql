-- 0193 -- Two low-severity hardening items from the pre-rollout audit
-- (2026-10-08).
--
-- 1. The deletion cron jobs fail OPEN if their secret is ever missing.
--    purge_scheduled_organization_deletions / purge_scheduled_data_deletions
--    guard with `secret is null or secret <> (select value from app_secrets
--    where key = 'cron_secret')`. If that row were ever deleted the subselect
--    is NULL, `secret <> NULL` is NULL, the IF is not taken, and ANY caller
--    -- including a logged-out one -- would run the purge. (The due_* reminder
--    jobs compare with `=` and fail closed already.) The guard is now
--    `coalesce(..., true)`, so a missing secret refuses everyone. The bodies
--    below are 0059's, character for character, apart from that one line.
--
-- 2. org_ai_spend_this_month / user_ai_spend_this_month answered for ANY id
--    from ANY caller (a logged-in user of one company could read another
--    company's AI spend). They now answer only for the caller's own company
--    (active member) or own user id, or a platform admin -- which covers every
--    caller in the app: the budget checks in lib/aiUsage/track.ts run as the
--    acting user, the admin tables run as the platform admin. Anyone else
--    gets 0, like an empty month.
--
-- Not changed: org_seat_limit_ok must stay readable by someone who is not yet a
-- member (the join policy calls it for the person joining); it only reveals
-- whether a seat is free.

create or replace function public.purge_scheduled_organization_deletions(secret text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count int;
begin
  if secret is null or coalesce(secret <> (select value from public.app_secrets where key = 'cron_secret'), true) then
    return 0;
  end if;

  with deleted as (
    delete from public.organizations
    where pending_deletion_at is not null and pending_deletion_at <= now()
    returning id
  )
  select count(*) into purged_count from deleted;

  return purged_count;
end;
$$;

create or replace function public.purge_scheduled_data_deletions(secret text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count int := 0;
  target record;
begin
  if secret is null or coalesce(secret <> (select value from public.app_secrets where key = 'cron_secret'), true) then
    return 0;
  end if;

  for target in
    select id from public.profiles
    where pending_data_deletion_at is not null and pending_data_deletion_at <= now()
  loop
    delete from public.development_plans where user_id = target.id;
    delete from public.coach_messages where user_id = target.id;
    delete from public.assessment_results where user_id = target.id;
    delete from public.gap_analyses where user_id = target.id;
    delete from public.resume_analyses where user_id = target.id;
    delete from public.discovery_profiles where user_id = target.id;
    delete from public.big_five_profiles where user_id = target.id;
    delete from public.coach_grow_memory where user_id = target.id;
    delete from public.user_achievements where user_id = target.id;
    delete from public.career_health_snapshots where user_id = target.id;
    delete from public.personal_tasks where user_id = target.id;
    delete from public.survey_responses where user_id = target.id;
    delete from public.survey_assignments where employee_user_id = target.id;
    delete from public.student_verification_codes where user_id = target.id;

    update public.profiles set
      full_name = null,
      location = null,
      learning_preferences = '{}'::text[],
      career_stage = null,
      accommodation = null,
      job_history = '[]'::jsonb,
      skills = '{}'::text[],
      qualifications = '[]'::jsonb,
      career_aspirations = null,
      student_school_email = null,
      student_verified_at = null,
      resource_tier = null,
      pending_data_deletion_at = null
    where id = target.id;

    purged_count := purged_count + 1;
  end loop;

  return purged_count;
end;
$$;

create or replace function public.org_ai_spend_this_month(target_org_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage_events
  where organization_id = target_org_id
    and created_at >= date_trunc('month', now())
    and (public.is_org_member(target_org_id) or public.is_admin());
$$;

create or replace function public.user_ai_spend_this_month(target_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage_events
  where user_id = target_user_id
    and organization_id is null
    and created_at >= date_trunc('month', now())
    and (target_user_id = auth.uid() or public.is_admin());
$$;
