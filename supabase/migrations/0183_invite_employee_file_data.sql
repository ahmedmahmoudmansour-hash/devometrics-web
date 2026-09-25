-- HR often has the full employee record before the person ever signs up
-- (personal details, hire date, employment type, address...). The invite form
-- only captured job/department/manager, so HR had to invite, wait for the
-- person to join, and only then open their file and type it all in.
--
-- organization_invites gains a nullable `file_data` jsonb holding whatever
-- employee-file fields HR entered at invite time (keys are the
-- employee_profiles column names). When the invitee joins, the app calls
-- apply_invite_file_data(), which copies it into their private employee file
-- (0181) and then CLEARS it from the invite, so sensitive data does not sit on
-- a table that is read for other purposes.
--
-- The function is SECURITY DEFINER because the person joining is not an admin
-- and has no write access to employee_profiles. It authorizes on the caller's
-- own verified email matching the invite's email, and on the invite belonging
-- to a company the caller is already a member of; it never throws (a bad value
-- must not block someone from joining), and it only fills fields, never blanks
-- an existing one.

alter table public.organization_invites
  add column if not exists file_data jsonb;

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
    organization_id, user_id, legal_name, date_of_birth, gender, nationality, national_id, marital_status,
    personal_phone, personal_email, address_line1, address_line2, city, region, postal_code, country,
    emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
    hire_date, employment_type, probation_end_date, updated_by, updated_at
  ) values (
    v_invite.organization_id, auth.uid(),
    nullif(d ->> 'legal_name', ''), nullif(d ->> 'date_of_birth', '')::date, nullif(d ->> 'gender', ''), nullif(d ->> 'nationality', ''),
    nullif(d ->> 'national_id', ''), v_marital,
    nullif(d ->> 'personal_phone', ''), nullif(d ->> 'personal_email', ''),
    nullif(d ->> 'address_line1', ''), nullif(d ->> 'address_line2', ''), nullif(d ->> 'city', ''), nullif(d ->> 'region', ''),
    nullif(d ->> 'postal_code', ''), nullif(d ->> 'country', ''),
    nullif(d ->> 'emergency_contact_name', ''), nullif(d ->> 'emergency_contact_relation', ''), nullif(d ->> 'emergency_contact_phone', ''),
    nullif(d ->> 'hire_date', '')::date, v_type, nullif(d ->> 'probation_end_date', '')::date,
    v_invite.invited_by, now()
  )
  on conflict (organization_id, user_id) do update set
    legal_name = coalesce(ep.legal_name, excluded.legal_name),
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
    emergency_contact_relation = coalesce(ep.emergency_contact_relation, excluded.emergency_contact_relation),
    emergency_contact_phone = coalesce(ep.emergency_contact_phone, excluded.emergency_contact_phone),
    hire_date = coalesce(ep.hire_date, excluded.hire_date),
    employment_type = coalesce(ep.employment_type, excluded.employment_type),
    probation_end_date = coalesce(ep.probation_end_date, excluded.probation_end_date),
    updated_at = now();

  update public.organization_invites set file_data = null where id = v_invite.id;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.apply_invite_file_data(uuid) from public;
grant execute on function public.apply_invite_file_data(uuid) to authenticated;
