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
