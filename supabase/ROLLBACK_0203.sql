-- ROLLBACK for migration 0203 (competency library). Emergency use only.
-- Run it only if 0203 has been applied and must be undone. It removes the library
-- fields and any role requirements that point at a company competency (those rows
-- cannot exist without the new column). Standard role requirements are untouched.
-- Take a copy of the rows first:
--   select * from public.role_competency_requirements where competency_id is not null;
--   select id, name, category, level_indicators, is_active from public.organization_competencies;

drop trigger if exists role_requirement_integrity on public.role_competency_requirements;
drop function if exists public.enforce_role_requirement_integrity();

delete from public.role_competency_requirements where competency_id is not null;

drop index if exists public.role_requirements_role_competency_uidx;
drop index if exists public.role_requirements_competency_idx;
alter table public.role_competency_requirements drop constraint if exists role_requirements_one_target_check;
alter table public.role_competency_requirements drop column if exists competency_id;
alter table public.role_competency_requirements alter column dimension set not null;

alter table public.organization_competencies drop constraint if exists organization_competencies_category_check;
alter table public.organization_competencies drop constraint if exists organization_competencies_level_indicators_check;
alter table public.organization_competencies drop constraint if exists organization_competencies_text_length_check;
alter table public.organization_competencies
  drop column if exists category,
  drop column if exists level_indicators,
  drop column if exists is_active,
  drop column if exists updated_at;
drop function if exists public.competency_level_indicators_valid(jsonb);
