-- 0207: knowledge checks (right-or-wrong questions linked to a role's competencies).
--
-- A knowledge check is a short set of single-best-answer questions drawn from the knowledge question bank for the competencies
-- a person's role requires. The question wording and the answer key live in the application's code, not in the database, so
-- this table holds only what is needed to rebuild the check and mark it:
--   question_ids : which bank questions were chosen (for example 'hr.recruitment#3')
--   seed         : how the answer options were shuffled for this person
--   answers      : what the person chose, as the ORIGINAL option index of each question
-- No score is stored. The score is worked out from the answers whenever it is shown, so it cannot be written directly and a
-- corrected answer key in a later bank version is visible at once.
--
-- Rules (enforced here, so they hold even if the application's checks are bypassed):
--   * the person's manager or a company admin can assign a check to someone in their own company; nobody can assign one to
--     themselves or to another company
--   * the person can read and answer only their own check; their manager and company admins can read it
--   * the person can save answers until they submit, and can submit once. After that nothing in the row can change
--   * only what the person answers can change; the questions, seed, role and language never can
--   * an unsubmitted check can be withdrawn by a company admin or by the manager who assigned it
--
-- Uses only existing helpers: is_org_admin (0016) and is_manager_of_user (0078/0172). Safe to run more than once.
-- To undo: supabase/ROLLBACK_0207.sql.

create table if not exists public.knowledge_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid references public.job_roles (id) on delete set null,
  -- Copied in, so the check still reads correctly if the role is later changed or deleted.
  role_title text not null default '',
  assigned_by uuid references auth.users (id) on delete set null,
  language text not null check (language in ('en', 'ar')),
  bank_version text not null check (char_length(bank_version) between 1 and 40),
  seed text not null check (char_length(seed) between 8 and 64),
  question_ids text[] not null check (cardinality(question_ids) between 1 and 60),
  -- What the role required when the check was made: {"hr.recruitment": 4, ...}
  required_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(required_levels) = 'object'),
  answers jsonb check (answers is null or jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists knowledge_checks_employee_idx on public.knowledge_checks (employee_user_id, created_at desc);
create index if not exists knowledge_checks_org_idx on public.knowledge_checks (organization_id, created_at desc);

alter table public.knowledge_checks enable row level security;

-- Is this person a member of this company? Read through a definer function so the answer does not depend on what the
-- caller may read, and written so that it can never throw inside a policy (it returns false instead).
create or replace function public.knowledge_check_member_ok(p_user uuid, p_org uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (select 1 from public.organization_members where user_id = p_user and organization_id = p_org);
exception when others then
  return false;
end;
$$;

revoke all on function public.knowledge_check_member_ok(uuid, uuid) from public;
grant execute on function public.knowledge_check_member_ok(uuid, uuid) to authenticated;

drop policy if exists "Read own, managed and company knowledge checks" on public.knowledge_checks;
create policy "Read own, managed and company knowledge checks"
  on public.knowledge_checks for select
  using (
    employee_user_id = auth.uid()
    or public.is_manager_of_user(employee_user_id)
    or public.is_org_admin(organization_id)
  );

drop policy if exists "Assign knowledge checks" on public.knowledge_checks;
create policy "Assign knowledge checks"
  on public.knowledge_checks for insert
  with check (
    assigned_by = auth.uid()
    and employee_user_id <> auth.uid()
    and answers is null
    and submitted_at is null
    and (public.is_org_admin(organization_id) or public.is_manager_of_user(employee_user_id))
    -- the person must belong to the same company the check is for
    and public.knowledge_check_member_ok(employee_user_id, organization_id)
  );

-- Only the person answers, and only until they have submitted. The guard trigger below limits which columns can change.
drop policy if exists "Answer own knowledge check" on public.knowledge_checks;
create policy "Answer own knowledge check"
  on public.knowledge_checks for update
  using (employee_user_id = auth.uid() and submitted_at is null)
  with check (employee_user_id = auth.uid());

drop policy if exists "Withdraw unsubmitted knowledge checks" on public.knowledge_checks;
create policy "Withdraw unsubmitted knowledge checks"
  on public.knowledge_checks for delete
  using (
    submitted_at is null
    and (public.is_org_admin(organization_id) or (assigned_by = auth.uid() and public.is_manager_of_user(employee_user_id)))
  );

-- Guard: a row policy cannot limit which columns an update touches, so this does.
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

drop trigger if exists knowledge_checks_guard_trg on public.knowledge_checks;
create trigger knowledge_checks_guard_trg
  before update on public.knowledge_checks
  for each row execute function public.knowledge_checks_guard();
