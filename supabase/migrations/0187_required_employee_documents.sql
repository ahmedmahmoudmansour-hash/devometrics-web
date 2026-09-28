-- Lets HR mark which employee-document types are required company-wide
-- (e.g. contract, national ID) so "who's missing what" can be computed and
-- surfaced, instead of HR having to open every employee's file one at a
-- time to check. Read access for the computation itself needs no new RPC
-- or RLS: org admins already have full SELECT on employee_documents and
-- organization_members (migrations 0181, 0016) -- this migration only adds
-- the "what's required" configuration.
--
-- Array, not a join table: the set of possible doc types is a small fixed
-- TS enum (lib/employeeFile/constants.ts's ALL_DOC_TYPES), the same shape
-- organizations.disabled_file_sections (0181) already uses for an
-- analogous per-org text[] setting, so this follows that precedent rather
-- than introducing a new table for what's really just a config value.
-- Defaults to '{}' (nothing required) -- adding this feature must never
-- retroactively flag every existing employee as "missing documents" the
-- company never actually asked for.

alter table public.organizations
  add column if not exists required_employee_doc_types text[] not null default '{}';

-- Idempotent constraint-name lookup, same pattern as
-- organizations_compensation_manager_visibility_check (0154) -- Postgres
-- auto-generated names drift across migration history and must never be
-- guessed.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_required_employee_doc_types_valid'
  ) then
    alter table public.organizations
      add constraint organizations_required_employee_doc_types_valid
      check (required_employee_doc_types <@ array['contract', 'offer_letter', 'national_id', 'passport', 'visa', 'certificate']::text[]);
  end if;
end $$;
