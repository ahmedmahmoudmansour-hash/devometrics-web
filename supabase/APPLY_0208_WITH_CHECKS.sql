-- ============================================================================
-- DEVOMETRICS: APPLY PACK FOR MIGRATION 0208 (knowledge checks: allow a role or an assigner to be deleted)
-- Fixes a bug in 0207: once someone had finished a knowledge check, the role it was for could no longer be deleted, and the
-- manager who assigned it could no longer be removed. Replaces one function; changes no table and no row.
--
-- Apply after 0207. Paste this whole file into the Supabase SQL Editor and press Run. One paste. The last result is a check
-- table: every row should say PASS. To undo: run supabase/ROLLBACK_0208.sql.
-- ============================================================================

-- 0208: let the database unlink a knowledge check from a deleted role or a removed assigner.
--
-- The guard added in 0207 refuses every change to a submitted check, and to the role and assigner columns of any check. But
-- two foreign keys change exactly those columns by themselves: deleting a job role sets knowledge_checks.role_id to null, and
-- deleting the user who assigned a check sets assigned_by to null. With the guard in the way both deletes failed with
-- "A submitted knowledge check cannot be changed", so a role could never be deleted once anyone had finished a check for it,
-- and a manager's account could never be removed.
--
-- The fix: when the change comes from inside a foreign-key action (trigger depth above 1, which a person's own UPDATE can never
-- have), allow it if it ONLY sets role_id and/or assigned_by to null and touches nothing else. A person's own update is still
-- limited to answers by the same guard and by the row policies. Safe to run more than once. To undo: supabase/ROLLBACK_0208.sql.

create or replace function public.knowledge_checks_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A foreign-key action unlinking a deleted role or a removed assigner. Nothing else may change in the same update.
  if pg_trigger_depth() > 1
     and (new.role_id is not distinct from old.role_id or new.role_id is null)
     and (new.assigned_by is not distinct from old.assigned_by or new.assigned_by is null)
     and new.id is not distinct from old.id
     and new.organization_id is not distinct from old.organization_id
     and new.employee_user_id is not distinct from old.employee_user_id
     and new.role_title is not distinct from old.role_title
     and new.language is not distinct from old.language
     and new.bank_version is not distinct from old.bank_version
     and new.seed is not distinct from old.seed
     and new.question_ids is not distinct from old.question_ids
     and new.required_levels is not distinct from old.required_levels
     and new.answers is not distinct from old.answers
     and new.created_at is not distinct from old.created_at
     and new.submitted_at is not distinct from old.submitted_at then
    return new;
  end if;
  if old.submitted_at is not null then
    raise exception 'A submitted knowledge check cannot be changed' using errcode = '23514';
  end if;
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.employee_user_id is distinct from old.employee_user_id
     or new.role_id is distinct from old.role_id
     or new.role_title is distinct from old.role_title
     or new.assigned_by is distinct from old.assigned_by
     or new.language is distinct from old.language
     or new.bank_version is distinct from old.bank_version
     or new.seed is distinct from old.seed
     or new.question_ids is distinct from old.question_ids
     or new.required_levels is distinct from old.required_levels
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the answers of a knowledge check can be changed' using errcode = '23514';
  end if;
  -- Submitting needs answers, and the time is set by the database, never by the caller.
  if new.submitted_at is not null then
    if new.answers is null then
      raise exception 'A knowledge check cannot be submitted without answers' using errcode = '23514';
    end if;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checks (the last result shown). Every row should say PASS.
select check_name, case when ok then 'PASS' else 'FAIL' end as result, detail
from (
  select 'the knowledge_checks table exists (0207 applied)' as check_name,
         to_regclass('public.knowledge_checks') is not null as ok,
         'public.knowledge_checks' as detail
  union all
  select 'the guard function has the new unlink rule',
         coalesce((select position('pg_trigger_depth' in pg_get_functiondef(p.oid)) > 0
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'knowledge_checks_guard' limit 1), false),
         'allows a foreign-key unlink of role_id or assigned_by, nothing else'
  union all
  select 'the guard is still attached to the table',
         exists (select 1 from pg_trigger where tgname = 'knowledge_checks_guard_trg' and not tgisinternal),
         'knowledge_checks_guard_trg'
) c
order by ok, check_name;
