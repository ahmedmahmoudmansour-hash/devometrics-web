-- 0200: names in English and Arabic.
--
-- Two places:
--  * profiles.full_name_ar: the Arabic form of the name shown in the app
--    (profiles.full_name stays the English one). Set by the person (sign-up or
--    profile) or by an admin of their company via set_member_arabic_name().
--  * the employee file (the private HR record): legal name as on the passport
--    or national ID, the emergency contact's name, and each dependent's name,
--    each with an Arabic form next to the existing English one. HR writes these
--    directly (the existing admin policies already cover new columns). The
--    employee writes their own through update_my_employee_file_ar(), because
--    update_my_employee_file() (0181) has a fixed argument list and RLS cannot
--    limit an UPDATE to chosen columns.
--
-- All Arabic names are optional and at most 200 characters.
--
-- Idempotent: safe to run more than once.

alter table public.profiles
  add column if not exists full_name_ar text;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_full_name_ar_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_full_name_ar_length_check
      check (full_name_ar is null or char_length(full_name_ar) <= 200);
  end if;
end $$;

-- Sign-up can now carry the Arabic name in the account metadata. Same body as
-- 0016, plus the new column. Trimmed and capped so a bad client cannot trip the
-- length check and block account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, full_name_ar, email, account_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name_ar', '')), 200), ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'individual')
  );
  return new;
end;
$$;

-- The one write path for an Arabic name: the person themselves, or an admin of
-- the company the person belongs to. Empty input clears the name.
create or replace function public.set_member_arabic_name(target_user_id uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;
  if auth.uid() <> target_user_id and not public.is_org_admin_of_user(target_user_id) then
    raise exception 'Not authorized';
  end if;

  cleaned := nullif(left(btrim(coalesce(new_name, '')), 200), '');

  update public.profiles set full_name_ar = cleaned where id = target_user_id;
end;
$$;

revoke all on function public.set_member_arabic_name(uuid, text) from public;
revoke all on function public.set_member_arabic_name(uuid, text) from anon;
grant execute on function public.set_member_arabic_name(uuid, text) to authenticated;

-- Directory: return the Arabic name too. A changed return type needs a drop and
-- re-create; everything else is identical to 0175 (same gates, same filters).
drop function if exists public.list_directory_entries(uuid);

create or replace function public.list_directory_entries(check_org_id uuid)
returns table (
  user_id uuid,
  full_name text,
  full_name_ar text,
  avatar_url text,
  email text,
  title text,
  department text,
  phone text,
  mobile_phone text,
  extension text,
  manager_name text,
  manager_email text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    om.user_id,
    p.full_name,
    p.full_name_ar,
    p.avatar_url,
    au.email,
    om.title,
    om.department,
    om.phone,
    om.mobile_phone,
    om.extension,
    om.manager_name,
    om.manager_email
  from public.organization_members om
  join public.profiles p on p.id = om.user_id
  join auth.users au on au.id = om.user_id
  join public.organizations o on o.id = om.organization_id
  where om.organization_id = check_org_id
    and om.archived is not true
    and coalesce(om.employment_status, 'active') = 'active'
    and o.directory_enabled = true
    and public.is_org_member(check_org_id);
$$;

revoke all on function public.list_directory_entries(uuid) from public;
revoke all on function public.list_directory_entries(uuid) from anon;
grant execute on function public.list_directory_entries(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Employee file: Arabic forms of the name fields.
alter table public.employee_profiles
  add column if not exists legal_name_ar text,
  add column if not exists emergency_contact_name_ar text;

alter table public.employee_dependents
  add column if not exists full_name_ar text;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'employee_profiles'
      and constraint_name = 'employee_profiles_arabic_names_length_check'
  ) then
    alter table public.employee_profiles
      add constraint employee_profiles_arabic_names_length_check
      check (
        (legal_name_ar is null or char_length(legal_name_ar) <= 200)
        and (emergency_contact_name_ar is null or char_length(emergency_contact_name_ar) <= 200)
      );
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'employee_dependents'
      and constraint_name = 'employee_dependents_full_name_ar_length_check'
  ) then
    alter table public.employee_dependents
      add constraint employee_dependents_full_name_ar_length_check
      check (full_name_ar is null or char_length(full_name_ar) <= 200);
  end if;
end $$;

-- The employee's own write path for the two Arabic fields on their file.
-- Touches only those two columns; blank becomes null. Same membership rule as
-- update_my_employee_file().
create or replace function public.update_my_employee_file_ar(
  p_legal_name_ar text,
  p_emergency_contact_name_ar text
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
    organization_id, user_id, legal_name_ar, emergency_contact_name_ar, updated_by, updated_at
  ) values (
    v_org, auth.uid(),
    nullif(left(btrim(coalesce(p_legal_name_ar, '')), 200), ''),
    nullif(left(btrim(coalesce(p_emergency_contact_name_ar, '')), 200), ''),
    auth.uid(), now()
  )
  on conflict (organization_id, user_id) do update set
    legal_name_ar = excluded.legal_name_ar,
    emergency_contact_name_ar = excluded.emergency_contact_name_ar,
    updated_by = auth.uid(),
    updated_at = now();
  return true;
end;
$$;

revoke all on function public.update_my_employee_file_ar(text, text) from public;
revoke all on function public.update_my_employee_file_ar(text, text) from anon;
grant execute on function public.update_my_employee_file_ar(text, text) to authenticated;

-- Invite-time capture. Same body as 0184, plus: the Arabic legal name, the
-- Arabic emergency contact name, each dependent's Arabic name, and the Arabic
-- display name (copied onto the person's profile only if they have none yet).
create or replace function public.apply_invite_file_data(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invites%rowtype;
  v_email text;
  d jsonb;
  v_marital text;
  v_type text;
  v_dependent jsonb;
  v_dep_name text;
  v_dep_name_ar text;
  v_dep_relation text;
  v_dep_dob text;
  v_display_ar text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    return false;
  end if;

  select oi.* into v_invite from public.organization_invites oi where oi.id = p_invite_id limit 1;
  if v_invite.id is null or lower(v_invite.email) <> v_email or v_invite.file_data is null then
    return false;
  end if;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = v_invite.organization_id and om.user_id = auth.uid()
  ) then
    return false;
  end if;

  d := v_invite.file_data;
  v_marital := nullif(d ->> 'marital_status', '');
  if v_marital is not null and v_marital not in ('single', 'married', 'divorced', 'widowed', 'other') then
    v_marital := null;
  end if;
  v_type := nullif(d ->> 'employment_type', '');
  if v_type is not null and v_type not in ('full_time', 'part_time', 'contract', 'intern', 'other') then
    v_type := null;
  end if;

  insert into public.employee_profiles as ep (
    organization_id, user_id, legal_name, legal_name_ar, date_of_birth, gender, nationality, national_id, marital_status,
    personal_phone, personal_email, address_line1, address_line2, city, region, postal_code, country,
    emergency_contact_name, emergency_contact_name_ar, emergency_contact_relation, emergency_contact_phone,
    hire_date, employment_type, probation_end_date, updated_by, updated_at
  ) values (
    v_invite.organization_id, auth.uid(),
    nullif(d ->> 'legal_name', ''), nullif(left(btrim(coalesce(d ->> 'legal_name_ar', '')), 200), ''),
    nullif(d ->> 'date_of_birth', '')::date, nullif(d ->> 'gender', ''), nullif(d ->> 'nationality', ''),
    nullif(d ->> 'national_id', ''), v_marital,
    nullif(d ->> 'personal_phone', ''), nullif(d ->> 'personal_email', ''),
    nullif(d ->> 'address_line1', ''), nullif(d ->> 'address_line2', ''), nullif(d ->> 'city', ''), nullif(d ->> 'region', ''),
    nullif(d ->> 'postal_code', ''), nullif(d ->> 'country', ''),
    nullif(d ->> 'emergency_contact_name', ''), nullif(left(btrim(coalesce(d ->> 'emergency_contact_name_ar', '')), 200), ''),
    nullif(d ->> 'emergency_contact_relation', ''), nullif(d ->> 'emergency_contact_phone', ''),
    nullif(d ->> 'hire_date', '')::date, v_type, nullif(d ->> 'probation_end_date', '')::date,
    v_invite.invited_by, now()
  )
  on conflict (organization_id, user_id) do update set
    legal_name = coalesce(ep.legal_name, excluded.legal_name),
    legal_name_ar = coalesce(ep.legal_name_ar, excluded.legal_name_ar),
    date_of_birth = coalesce(ep.date_of_birth, excluded.date_of_birth),
    gender = coalesce(ep.gender, excluded.gender),
    nationality = coalesce(ep.nationality, excluded.nationality),
    national_id = coalesce(ep.national_id, excluded.national_id),
    marital_status = coalesce(ep.marital_status, excluded.marital_status),
    personal_phone = coalesce(ep.personal_phone, excluded.personal_phone),
    personal_email = coalesce(ep.personal_email, excluded.personal_email),
    address_line1 = coalesce(ep.address_line1, excluded.address_line1),
    address_line2 = coalesce(ep.address_line2, excluded.address_line2),
    city = coalesce(ep.city, excluded.city),
    region = coalesce(ep.region, excluded.region),
    postal_code = coalesce(ep.postal_code, excluded.postal_code),
    country = coalesce(ep.country, excluded.country),
    emergency_contact_name = coalesce(ep.emergency_contact_name, excluded.emergency_contact_name),
    emergency_contact_name_ar = coalesce(ep.emergency_contact_name_ar, excluded.emergency_contact_name_ar),
    emergency_contact_relation = coalesce(ep.emergency_contact_relation, excluded.emergency_contact_relation),
    emergency_contact_phone = coalesce(ep.emergency_contact_phone, excluded.emergency_contact_phone),
    hire_date = coalesce(ep.hire_date, excluded.hire_date),
    employment_type = coalesce(ep.employment_type, excluded.employment_type),
    probation_end_date = coalesce(ep.probation_end_date, excluded.probation_end_date),
    updated_at = now();

  v_display_ar := nullif(left(btrim(coalesce(d ->> 'full_name_ar', '')), 200), '');
  if v_display_ar is not null then
    update public.profiles set full_name_ar = v_display_ar where id = auth.uid() and full_name_ar is null;
  end if;

  if jsonb_typeof(d -> 'dependents') = 'array' then
    for v_dependent in select * from jsonb_array_elements(d -> 'dependents')
    loop
      v_dep_name := nullif(trim(both from (v_dependent ->> 'full_name')), '');
      v_dep_name_ar := nullif(left(btrim(coalesce(v_dependent ->> 'full_name_ar', '')), 200), '');
      v_dep_relation := nullif(v_dependent ->> 'relation', '');
      v_dep_dob := nullif(v_dependent ->> 'date_of_birth', '');
      if v_dep_name is not null and v_dep_relation in ('spouse', 'child', 'parent', 'sibling', 'other') then
        insert into public.employee_dependents (organization_id, user_id, full_name, full_name_ar, relation, date_of_birth)
        values (v_invite.organization_id, auth.uid(), v_dep_name, v_dep_name_ar, v_dep_relation, v_dep_dob::date);
      end if;
    end loop;
  end if;

  update public.organization_invites set file_data = null where id = v_invite.id;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.apply_invite_file_data(uuid) from public;
grant execute on function public.apply_invite_file_data(uuid) to authenticated;
