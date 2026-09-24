-- Employee file: the private HR record for one person -- personal, contact
-- and address details, emergency contact, family/dependents, hiring and
-- employment data, and uploaded documents (contract, ID, certificates).
--
-- Privacy first: this is some of the most sensitive data in the app, so it is
-- deliberately NOT stored on organization_members (whose SELECT policy lets
-- every org peer read every row). It lives in its own tables that only the
-- employee themselves and org admins can read -- no managers, no peers.
--
--  * employee_profiles   one row per person. Admins manage everything. The
--    employee can read their own row but changes it ONLY through
--    update_my_employee_file() (RLS cannot limit which columns an UPDATE
--    touches, so a raw self-UPDATE policy would let someone edit their own
--    hire date or employment type). Hiring/employment fields are HR-only.
--  * employee_dependents family members; the employee manages their own,
--    admins manage anyone's.
--  * employee_documents  metadata for files in the private employee-documents
--    bucket. Employees upload ID/passport/visa/certificates/other for
--    themselves; contracts and offer letters are HR-only.
--
-- Each company chooses which sections it collects
-- (organizations.disabled_file_sections); the personal/employment core is
-- always on.

alter table public.organizations
  add column if not exists disabled_file_sections text[] not null default '{}';

create table if not exists public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- personal (employee-editable)
  legal_name text,
  date_of_birth date,
  gender text,
  nationality text,
  national_id text,
  marital_status text check (marital_status in ('single', 'married', 'divorced', 'widowed', 'other')),
  -- contact and address (employee-editable)
  personal_phone text,
  personal_email text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  -- emergency contact (employee-editable)
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  -- hiring / employment (HR-only)
  hire_date date,
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'intern', 'other')),
  probation_end_date date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (organization_id, user_id)
);

alter table public.employee_profiles enable row level security;

drop policy if exists "Org admins manage employee files" on public.employee_profiles;
create policy "Org admins manage employee files"
  on public.employee_profiles for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Employees read their own file" on public.employee_profiles;
create policy "Employees read their own file"
  on public.employee_profiles for select
  using (user_id = auth.uid() and public.is_org_member(organization_id));

create index if not exists employee_profiles_org_idx on public.employee_profiles (organization_id);

-- The only way an employee changes their own file. Upserts the caller's row
-- and touches ONLY the employee-editable columns. Blank strings become null.
create or replace function public.update_my_employee_file(
  p_legal_name text, p_date_of_birth date, p_gender text, p_nationality text, p_national_id text, p_marital_status text,
  p_personal_phone text, p_personal_email text,
  p_address_line1 text, p_address_line2 text, p_city text, p_region text, p_postal_code text, p_country text,
  p_emergency_contact_name text, p_emergency_contact_relation text, p_emergency_contact_phone text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select om.organization_id into v_org
  from public.organization_members om
  where om.user_id = auth.uid()
    and coalesce(om.employment_status, 'active') = 'active'
  limit 1;
  if v_org is null then
    raise exception 'Not a member of a company workspace';
  end if;

  insert into public.employee_profiles as ep (
    organization_id, user_id, legal_name, date_of_birth, gender, nationality, national_id, marital_status,
    personal_phone, personal_email, address_line1, address_line2, city, region, postal_code, country,
    emergency_contact_name, emergency_contact_relation, emergency_contact_phone, updated_by, updated_at
  ) values (
    v_org, auth.uid(), nullif(trim(p_legal_name), ''), p_date_of_birth, nullif(trim(p_gender), ''), nullif(trim(p_nationality), ''),
    nullif(trim(p_national_id), ''), nullif(trim(p_marital_status), ''),
    nullif(trim(p_personal_phone), ''), nullif(trim(p_personal_email), ''),
    nullif(trim(p_address_line1), ''), nullif(trim(p_address_line2), ''), nullif(trim(p_city), ''), nullif(trim(p_region), ''),
    nullif(trim(p_postal_code), ''), nullif(trim(p_country), ''),
    nullif(trim(p_emergency_contact_name), ''), nullif(trim(p_emergency_contact_relation), ''), nullif(trim(p_emergency_contact_phone), ''),
    auth.uid(), now()
  )
  on conflict (organization_id, user_id) do update set
    legal_name = excluded.legal_name,
    date_of_birth = excluded.date_of_birth,
    gender = excluded.gender,
    nationality = excluded.nationality,
    national_id = excluded.national_id,
    marital_status = excluded.marital_status,
    personal_phone = excluded.personal_phone,
    personal_email = excluded.personal_email,
    address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2,
    city = excluded.city,
    region = excluded.region,
    postal_code = excluded.postal_code,
    country = excluded.country,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_relation = excluded.emergency_contact_relation,
    emergency_contact_phone = excluded.emergency_contact_phone,
    updated_by = auth.uid(),
    updated_at = now();
  return true;
end;
$$;

revoke all on function public.update_my_employee_file(text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.update_my_employee_file(text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

create table if not exists public.employee_dependents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  relation text not null check (relation in ('spouse', 'child', 'parent', 'sibling', 'other')),
  date_of_birth date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.employee_dependents enable row level security;

drop policy if exists "Org admins manage dependents" on public.employee_dependents;
create policy "Org admins manage dependents"
  on public.employee_dependents for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Employees manage their own dependents" on public.employee_dependents;
create policy "Employees manage their own dependents"
  on public.employee_dependents for all
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

create index if not exists employee_dependents_user_idx on public.employee_dependents (organization_id, user_id);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_type text not null check (doc_type in ('contract', 'offer_letter', 'national_id', 'passport', 'visa', 'certificate', 'other')),
  title text not null,
  storage_path text not null,
  file_name text not null,
  expires_on date,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.employee_documents enable row level security;

drop policy if exists "Org admins manage employee documents" on public.employee_documents;
create policy "Org admins manage employee documents"
  on public.employee_documents for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Employees read their own documents" on public.employee_documents;
create policy "Employees read their own documents"
  on public.employee_documents for select
  using (user_id = auth.uid() and public.is_org_member(organization_id));

-- Employees add ID/passport/visa/certificate/other for themselves; contracts
-- and offer letters are HR-only, so an employee cannot plant one.
drop policy if exists "Employees upload their own documents" on public.employee_documents;
create policy "Employees upload their own documents"
  on public.employee_documents for insert
  with check (
    user_id = auth.uid()
    and uploaded_by = auth.uid()
    and public.is_org_member(organization_id)
    and doc_type in ('national_id', 'passport', 'visa', 'certificate', 'other')
  );

-- ...and remove only what they uploaded themselves.
drop policy if exists "Employees remove their own uploads" on public.employee_documents;
create policy "Employees remove their own uploads"
  on public.employee_documents for delete
  using (user_id = auth.uid() and uploaded_by = auth.uid());

create index if not exists employee_documents_user_idx on public.employee_documents (organization_id, user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- (storage.foldername(name))[1] = organization_id, [2] = employee user id.
drop policy if exists "Admins manage employee document files" on storage.objects;
create policy "Admins manage employee document files"
  on storage.objects for all
  using (bucket_id = 'employee-documents' and public.is_org_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'employee-documents' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "Employees upload their own document files" on storage.objects;
create policy "Employees upload their own document files"
  on storage.objects for insert
  with check (
    bucket_id = 'employee-documents'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2])::uuid = auth.uid()
  );

drop policy if exists "Employees read their own document files" on storage.objects;
create policy "Employees read their own document files"
  on storage.objects for select
  using (bucket_id = 'employee-documents' and ((storage.foldername(name))[2])::uuid = auth.uid());

drop policy if exists "Employees delete their own document files" on storage.objects;
create policy "Employees delete their own document files"
  on storage.objects for delete
  using (bucket_id = 'employee-documents' and ((storage.foldername(name))[2])::uuid = auth.uid());

-- Who looked at someone else's file. Written by the app whenever an admin
-- opens another person's file or one of their documents; only admins can read
-- it, and nobody can edit or delete entries (no update/delete policy).
create table if not exists public.employee_file_access_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  subject_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('view_file', 'view_document')),
  detail text,
  created_at timestamptz not null default now()
);

alter table public.employee_file_access_log enable row level security;

drop policy if exists "Org admins read the file access log" on public.employee_file_access_log;
create policy "Org admins read the file access log"
  on public.employee_file_access_log for select
  using (public.is_org_admin(organization_id));

drop policy if exists "Org admins record their own file access" on public.employee_file_access_log;
create policy "Org admins record their own file access"
  on public.employee_file_access_log for insert
  with check (actor_user_id = auth.uid() and public.is_org_admin(organization_id));

create index if not exists employee_file_access_log_subject_idx on public.employee_file_access_log (organization_id, subject_user_id, created_at desc);
