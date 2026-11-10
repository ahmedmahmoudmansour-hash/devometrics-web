-- ROLLBACK for migration 0208: puts the guard back exactly as 0207 made it. After this, a role that has a knowledge check
-- cannot be deleted again (see 0208 for why). Changes no data.
create or replace function public.knowledge_checks_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
