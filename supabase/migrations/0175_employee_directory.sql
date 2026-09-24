-- Employee directory — a lightweight, employee-facing "who is this person
-- and how do I reach them" surface: basic info, contact (email/phone/
-- mobile/extension), department, and line manager, searchable across the
-- whole company. Deliberately separate from the existing admin-only
-- /dashboard/company/[userId] page (gap analysis, flight risk, performance
-- data) — different audience (every employee, not just admins) and
-- different, much narrower data.
--
-- Off by default per org ("don't think all HR would need this to appear
-- for everyone") — an org admin opts in explicitly from Settings, same
-- opt-in-default judgment call as compensation_manager_visibility (0154).
--
-- profiles has accumulated a lot of sensitive, unrelated columns over time
-- (AI budget, subscription tier, admin flag, disable-access flags, ...) —
-- RLS is row-level, not column-level, so a broad new "org peers can read
-- profiles" policy would expose all of it, not just name/avatar. Instead of
-- widening profiles' RLS at all, every directory read goes through a
-- SECURITY DEFINER function that returns only the specific safe columns
-- needed here — the same "narrow projection, not a broad grant" instinct
-- as compensation's RPC-only reads, applied for exposure reasons here
-- rather than compensation's audit-logging reasons.

alter table public.organizations
  add column if not exists directory_enabled boolean not null default false;

-- Self-editable contact fields. Deliberately NOT covered by any raw UPDATE
-- policy (see update_my_contact_info below) — organization_members has no
-- self-service UPDATE policy at all today (0049's admin-only policy is the
-- only one), and RLS can't scope an UPDATE to just these three columns, so
-- a broad "user can update own row" policy would let someone rewrite their
-- own role/employment_status/performance_rating. A narrow RPC sidesteps
-- that entirely instead of trying to claw it back with a WITH CHECK clause.
alter table public.organization_members
  add column if not exists phone text,
  add column if not exists mobile_phone text,
  add column if not exists extension text;

create or replace function public.update_my_contact_info(p_phone text, p_mobile_phone text, p_extension text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organization_members
  set phone = nullif(trim(p_phone), ''),
      mobile_phone = nullif(trim(p_mobile_phone), ''),
      extension = nullif(trim(p_extension), '')
  where user_id = auth.uid();
  return true;
end;
$$;

revoke all on function public.update_my_contact_info(text, text, text) from public;
grant execute on function public.update_my_contact_info(text, text, text) to authenticated;

-- The one read path for the directory. Gated on the caller being an active
-- member of check_org_id (is_org_member, 0172-aware) AND that org having
-- opted in (directory_enabled) — both checked inside the function itself,
-- not left to the caller, so a direct RPC call can't skip either gate.
-- Archived/inactive members are excluded (nothing useful to contact them
-- about, and it'd otherwise leak who recently left).
create or replace function public.list_directory_entries(check_org_id uuid)
returns table (
  user_id uuid,
  full_name text,
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
grant execute on function public.list_directory_entries(uuid) to authenticated;
