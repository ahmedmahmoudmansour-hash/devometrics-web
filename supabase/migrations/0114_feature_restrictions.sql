-- Granular per-feature access control for Enterprise orgs. Every access rule
-- in this app up to now has been coarse and all-or-nothing: subscription
-- tier (free/premium/enterprise), org-admin-or-not, or a full account/org
-- disable (migrations 0112/0113). This adds the missing middle layer: an
-- org admin restricting ONE specific module (AI Coaching, Resume
-- Intelligence/ATS optimization, Roleplay, Career Development, Knowledge
-- Hub, Job Architecture, Competency Management) for a specific employee or
-- a whole department, while everything else stays available. Default is
-- opt-out (everything enabled) — a restriction row is only ever a "this is
-- OFF for this person/department" entry, never an allow-list.

create table if not exists public.organization_feature_restrictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key text not null,
  scope_type text not null check (scope_type in ('user', 'department')),
  user_id uuid references auth.users (id) on delete cascade,
  department text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint org_feature_restrictions_scope_shape check (
    (scope_type = 'user' and user_id is not null and department is null)
    or (scope_type = 'department' and department is not null and user_id is null)
  )
);

-- Two partial unique indexes rather than one plain unique constraint on
-- (organization_id, feature_key, scope_type, user_id, department) — Postgres
-- treats every NULL as distinct in a unique constraint, so a plain one would
-- silently let duplicate department-scoped rows through (user_id is always
-- null there) and vice versa. Partial indexes scoped to each branch actually
-- enforce "one restriction per feature per person/department."
create unique index if not exists org_feature_restrictions_user_uidx
  on public.organization_feature_restrictions (organization_id, feature_key, user_id)
  where scope_type = 'user';
create unique index if not exists org_feature_restrictions_dept_uidx
  on public.organization_feature_restrictions (organization_id, feature_key, department)
  where scope_type = 'department';

create index if not exists org_feature_restrictions_org_idx
  on public.organization_feature_restrictions (organization_id);

alter table public.organization_feature_restrictions enable row level security;

-- Management (select/insert/update/delete) is admin-only — same "for all"
-- shape as 0081's platform-admin invites policy. Regular employees never
-- get raw table access at all; they only ever learn whether THEY are
-- restricted via the SECURITY DEFINER function below, which needs no grant
-- on the table itself.
drop policy if exists "Org admins can manage their org's feature restrictions" on public.organization_feature_restrictions;
create policy "Org admins can manage their org's feature restrictions"
  on public.organization_feature_restrictions for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Platform admins can manage any org's feature restrictions" on public.organization_feature_restrictions;
create policy "Platform admins can manage any org's feature restrictions"
  on public.organization_feature_restrictions for all
  using (public.is_admin())
  with check (public.is_admin());

-- The single function every gated feature actually calls: every restricted
-- feature key for the CALLING user, across both their individual
-- user-scoped restrictions and their department's restrictions (looked up
-- from their own organization_members row, never a client-supplied value).
-- One round trip covers both a single feature check (`'x' = any(result)`)
-- and bulk nav-hiding (checking several keys against the same array) without
-- needing N separate calls. Wrapped in exception handling and returns an
-- empty (nothing restricted) array on any failure — a broken restriction
-- check must never block real feature use, same fail-open posture as
-- assertAiBudgetOk.
create or replace function public.list_my_restricted_features(check_org_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  my_department text;
  result text[];
begin
  select department into my_department
  from public.organization_members
  where organization_id = check_org_id and user_id = auth.uid()
  limit 1;

  select coalesce(array_agg(distinct r.feature_key), '{}')
  into result
  from public.organization_feature_restrictions r
  where r.organization_id = check_org_id
    and (
      (r.scope_type = 'user' and r.user_id = auth.uid())
      or (r.scope_type = 'department' and my_department is not null and r.department = my_department)
    );

  return coalesce(result, '{}');
exception when others then
  return '{}';
end;
$$;

revoke all on function public.list_my_restricted_features(uuid) from public;
grant execute on function public.list_my_restricted_features(uuid) to authenticated;
