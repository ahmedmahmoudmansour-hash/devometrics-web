-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0187
--
-- Everything through 0186 is applied and verified live (2026-09-28).
--
-- 0187 -- Adds organizations.required_employee_doc_types (text[], default
-- '{}'): lets HR mark which employee-document types (contract, offer
-- letter, national ID, passport, visa, certificate) are required
-- company-wide. Powers the new "who's missing a required document" view
-- on the employees roster page. No RLS/RPC changes needed -- org admins
-- already have full read access to employee_documents and
-- organization_members, this migration only adds the "what's required"
-- config column, same shape as disabled_file_sections (0181).
-- ============================================================

alter table public.organizations
  add column if not exists required_employee_doc_types text[] not null default '{}';

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
