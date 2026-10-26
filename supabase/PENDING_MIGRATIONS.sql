-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0203 only (awaiting review)
--
-- 0203  Competency library: category, level indicators and retire flag on
--       company competencies; role requirements can point at a company
--       competency; same-company guard.
--
-- Everything through 0202 is already applied and verified live.
-- Safe to run more than once. Nothing existing is changed or removed.
-- ============================================================

-- 0203: competency library, and role requirements that can use company competencies.
--
-- Where things stood:
--   * The 8 standard competencies (Technical Skills, Leadership, ...) are fixed in
--     the application. They drive scoring, gap analysis and role requirements.
--   * A company can define its own competencies (organization_competencies, 0035).
--     They are already rated by id in Impact Cycles.
--   * A role's required levels (role_competency_requirements, 0067) could only name
--     one of the 8 standard dimensions, so company competencies could not be
--     required by a role.
--
-- What this adds (nothing is removed or rewritten):
--   1. Library fields on company competencies: a category, observable indicators
--      for each of the five proficiency levels, and an "active" flag so a
--      competency can be retired instead of deleted.
--   2. role_competency_requirements.competency_id: a role requirement can point at a
--      company competency instead of a standard dimension. Exactly one of the two
--      is set. A competency is defined once and reused by any number of roles.
--   3. A guard so a requirement can only join a role and a competency that belong
--      to the same company (the same cross-company rule as 0197).
--
-- Existing rows are untouched: every current requirement keeps its dimension and
-- has no competency_id. Standard competencies stay in the application, with their
-- descriptions and level indicators in the translation files.
--
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Library fields on company competencies
alter table public.organization_competencies
  add column if not exists category text not null default 'behavioural',
  add column if not exists level_indicators jsonb not null default '{}'::jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- level_indicators is an object whose keys are "1" to "5" and whose values are
-- text of at most 400 characters, for example {"1": "Follows the steps with
-- guidance", "3": "Works to the standard alone"}. Missing levels are allowed.
create or replace function public.competency_level_indicators_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then false
    else not exists (
      select 1
      from jsonb_each(p) as e(k, v)
      where e.k not in ('1', '2', '3', '4', '5')
         or jsonb_typeof(e.v) <> 'string'
         or char_length(e.v #>> '{}') > 400
    )
  end;
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organization_competencies'
      and constraint_name = 'organization_competencies_category_check'
  ) then
    alter table public.organization_competencies
      add constraint organization_competencies_category_check
      check (category in ('behavioural', 'technical', 'functional'));
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organization_competencies'
      and constraint_name = 'organization_competencies_level_indicators_check'
  ) then
    alter table public.organization_competencies
      add constraint organization_competencies_level_indicators_check
      check (public.competency_level_indicators_valid(level_indicators));
  end if;

  -- Length limits the application already applies. NOT VALID so any existing row
  -- is left alone; the limits apply to every new or changed row.
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organization_competencies'
      and constraint_name = 'organization_competencies_text_length_check'
  ) then
    alter table public.organization_competencies
      add constraint organization_competencies_text_length_check
      check (char_length(name) <= 120 and (description is null or char_length(description) <= 1000))
      not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. A role requirement can point at a company competency
alter table public.role_competency_requirements
  add column if not exists competency_id uuid
    references public.organization_competencies (id) on delete restrict;

-- A requirement for a company competency has no standard dimension.
alter table public.role_competency_requirements
  alter column dimension drop not null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'role_competency_requirements'
      and constraint_name = 'role_requirements_one_target_check'
  ) then
    alter table public.role_competency_requirements
      add constraint role_requirements_one_target_check
      check ((dimension is not null) <> (competency_id is not null));
  end if;
end $$;

-- One requirement per role and competency. (The existing unique constraint on
-- role_id + dimension still covers the standard ones; rows with no dimension are
-- distinct to it, and rows with no competency_id are distinct to this index.)
create unique index if not exists role_requirements_role_competency_uidx
  on public.role_competency_requirements (role_id, competency_id);

create index if not exists role_requirements_competency_idx
  on public.role_competency_requirements (competency_id);

-- ---------------------------------------------------------------------------
-- 3. Same-company guard
-- The role and the competency must both belong to the company named on the row.
-- This holds even if someone bypasses the application and writes to the table
-- directly. The same guard stops a retired competency being attached to a role
-- that does not already use it, while still allowing the level to be edited on a
-- role that does (including an upsert, which presents as an insert first).
create or replace function public.enforce_role_requirement_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_org uuid;
  v_comp_org uuid;
  v_comp_active boolean;
begin
  select organization_id into v_role_org from public.job_roles where id = new.role_id;
  if v_role_org is null or v_role_org <> new.organization_id then
    raise exception 'The role does not belong to this company' using errcode = '23514';
  end if;

  if new.competency_id is not null then
    select organization_id, is_active into v_comp_org, v_comp_active
    from public.organization_competencies where id = new.competency_id;
    if v_comp_org is null or v_comp_org <> new.organization_id then
      raise exception 'The competency does not belong to this company' using errcode = '23514';
    end if;

    -- A retired competency cannot be newly attached to a role. A role that
    -- already requires it keeps it, and its level can still be changed.
    if v_comp_active = false
       and (tg_op = 'INSERT' or new.competency_id is distinct from old.competency_id or new.role_id is distinct from old.role_id)
       and not exists (
         select 1 from public.role_competency_requirements r
         where r.role_id = new.role_id and r.competency_id = new.competency_id
       )
    then
      raise exception 'This competency is retired and cannot be added to a role' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists role_requirement_integrity on public.role_competency_requirements;
create trigger role_requirement_integrity
  before insert or update of role_id, competency_id, organization_id
  on public.role_competency_requirements
  for each row execute function public.enforce_role_requirement_integrity();
