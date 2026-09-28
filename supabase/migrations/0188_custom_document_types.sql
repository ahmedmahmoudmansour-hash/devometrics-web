-- Lets HR define their own hiring/employee-document types beyond the 6
-- fixed ones (contract, offer letter, national ID, passport, visa,
-- certificate) -- e.g. "NDA" or "Background Check Consent". Mirrors
-- organization_competencies (0035) exactly: a fixed system stays the
-- actual mechanism (employee_documents.doc_type is still just a text
-- column, HR-only-upload is still enforced the same way), this table is a
-- per-org extension on top, not a second document system. A custom type's
-- label is rendered verbatim, no i18n of its own -- same as
-- organization_competencies.name.
--
-- Depends on 0181 (employee_documents), 0187 (required_employee_doc_types).

create table if not exists public.organization_document_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_label text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

alter table public.organization_document_types enable row level security;

drop policy if exists "Org members can view custom document types" on public.organization_document_types;
create policy "Org members can view custom document types"
  on public.organization_document_types for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins manage custom document types" on public.organization_document_types;
create policy "Org admins manage custom document types"
  on public.organization_document_types for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists organization_document_types_org_idx on public.organization_document_types (organization_id);

-- employee_documents.doc_type (0181) is used both for the 6 fixed system
-- keys AND, from here on, a custom type's own row id (its uuid, as text)
-- -- a CHECK constraint can't reference another table, so the strict
-- fixed-list check is replaced with a light sanity bound; real validity
-- (a known fixed key, or a real organization_document_types row in the
-- caller's own org) is enforced by attachEmployeeDocument()
-- (lib/employeeFile/actions.ts), the only insert path client code uses.
-- The RLS insert policy that limits an EMPLOYEE's own upload to the 5
-- employee-facing fixed types is untouched and still applies unchanged --
-- a custom type's key is never one of those 5 literal strings, so an
-- employee still cannot self-upload a custom type; only an org admin can,
-- exactly like contract/offer_letter today.
do $$
declare
  v_name text;
begin
  select constraint_name into v_name
  from information_schema.table_constraints
  where table_schema = 'public' and table_name = 'employee_documents'
    and constraint_type = 'CHECK' and constraint_name like '%doc_type%'
  limit 1;
  if v_name is not null then
    execute format('alter table public.employee_documents drop constraint %I', v_name);
  end if;
end $$;

alter table public.employee_documents
  add constraint employee_documents_doc_type_length check (char_length(doc_type) between 1 and 100);

-- organizations.required_employee_doc_types (0187) needs the same
-- relaxation -- its fixed-array check would reject a custom type's uuid
-- key. Real validity is enforced the same way, in setRequiredDocTypes().
alter table public.organizations
  drop constraint if exists organizations_required_employee_doc_types_valid;
