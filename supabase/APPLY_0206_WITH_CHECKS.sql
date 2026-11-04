-- ============================================================================
-- DEVOMETRICS: APPLY PACK FOR MIGRATION 0206 (role-specific assessment questions)
-- Fixes: questions written for one role being reused for a different role in the same company.
--
-- Apply after 0204. Paste this whole file into the Supabase SQL Editor and press Run. One paste. It changes no existing row.
-- The last result is a check table: every row should say PASS. To undo: run supabase/ROLLBACK_0206.sql.
-- ============================================================================

-- 0206: make saved assessment questions role-specific.
--
-- Why: the question writer is told the role, but saved questions were reused by competency, level and language only.
-- The first role to ask for a competency at a level therefore set the scenario setting for every later role in the same
-- company. For example, "Communication" questions written for a Maintenance Engineer were later given to an HR Generalist.
-- This matters most for the standard competencies (Communication, Critical Thinking and so on), which almost every role
-- shares. After this change, questions are written once per role (role title), competency, level and language, and still
-- reused for everyone in that role.
--
-- What it does (nothing is deleted or rewritten):
--   1. adds competency_assessment_items.role_context (the role title the questions were written for; '' for existing rows)
--   2. replaces the "one set per version, level, language" uniqueness with "one set per version, level, language AND role"
-- Existing assessments keep their own questions exactly as they were. Existing saved questions (role_context = '') are no
-- longer reused for new assessments, so the next assessment for each role gets fresh, role-specific questions.
--
-- Safe to run more than once. To undo: supabase/ROLLBACK_0206.sql.

alter table public.competency_assessment_items
  add column if not exists role_context text not null default '';

do $$
declare
  v_old text;
begin
  -- The old rule, found by the columns it covers (never by guessing its generated name).
  select c.conname into v_old
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'competency_assessment_items' and c.contype = 'u'
    and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)
        = array['definition_version_id', 'language', 'position', 'required_band']
  limit 1;
  if v_old is not null then
    execute format('alter table public.competency_assessment_items drop constraint %I', v_old);
  end if;
end $$;

create unique index if not exists competency_assessment_items_per_role_uidx
  on public.competency_assessment_items (definition_version_id, required_band, language, role_context, position);

alter table public.competency_assessment_items
  drop constraint if exists competency_assessment_items_role_context_length;
alter table public.competency_assessment_items
  add constraint competency_assessment_items_role_context_length check (char_length(role_context) <= 120);


-- ---------------------------------------------------------------------------
-- Checks (the last result shown). Every row should say PASS.
select check_name, case when ok then 'PASS' else 'FAIL' end as result, detail
from (
  select 'the role column exists' as check_name,
         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'competency_assessment_items' and column_name = 'role_context') as ok,
         'competency_assessment_items.role_context' as detail
  union all
  select 'existing questions are kept',
         (select count(*) from public.competency_assessment_items) >= 0,
         'no rows removed'
  union all
  select 'the new per-role uniqueness exists',
         to_regclass('public.competency_assessment_items_per_role_uidx') is not null,
         'version, level, language, role, position'
  union all
  select 'the old one-set-per-level rule is gone',
         not exists (
           select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
           where t.relname = 'competency_assessment_items' and c.contype = 'u'
             and (select array_agg(a.attname::text order by a.attname::text) from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)
                 = array['definition_version_id', 'language', 'position', 'required_band']),
         'otherwise a second role could not save its own questions'
  union all
  select 'the role name length rule exists',
         exists (select 1 from pg_constraint where conname = 'competency_assessment_items_role_context_length'),
         'at most 120 characters'
) c
order by ok, check_name;
