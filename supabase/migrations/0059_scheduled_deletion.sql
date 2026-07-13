-- Recovery window for the two most catastrophic actions in the app
-- ("Delete my data" and "Delete company workspace"). Neither previously
-- had ANY way to undo — both were an immediate, permanent hard delete.
-- This doesn't change that outcome, it just delays it: clicking delete now
-- schedules the real deletion 7 days out and the UI offers a "Cancel"
-- button during that window. Nothing about how the app reads/queries
-- organizations or profiles changes — the workspace/account keeps working
-- completely normally during the grace period, which is what keeps this
-- safe to add without touching the many existing queries against these
-- tables.

alter table public.organizations
  add column if not exists pending_deletion_at timestamptz;

alter table public.profiles
  add column if not exists pending_data_deletion_at timestamptz;

-- Actually performs the deferred organization deletes once the grace
-- period has passed. A single delete; on-delete-cascade FKs (0016/0017)
-- clean up members/invites/succession roles/etc. automatically, same as
-- the immediate delete this replaces.
create or replace function public.purge_scheduled_organization_deletions(secret text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  purged_count int;
begin
  if secret is null or secret <> (select value from public.app_secrets where key = 'cron_secret') then
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

revoke all on function public.purge_scheduled_organization_deletions(text) from public;
grant execute on function public.purge_scheduled_organization_deletions(text) to anon, authenticated;

-- Actually performs the deferred personal-data wipe once the grace period
-- has passed — the exact same 14 tables + profile field reset the
-- immediate deleteMyData() path used to do (app/dashboard/actions.ts),
-- just deferred and cancelable in the meantime.
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
  if secret is null or secret <> (select value from public.app_secrets where key = 'cron_secret') then
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

revoke all on function public.purge_scheduled_data_deletions(text) from public;
grant execute on function public.purge_scheduled_data_deletions(text) to anon, authenticated;
