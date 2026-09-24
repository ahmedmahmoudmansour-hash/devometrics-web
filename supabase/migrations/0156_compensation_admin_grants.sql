-- Compensation Management, part 3/8: the Compensation Admin permission
-- grant table. Deliberately NOT a new organization_members.role value —
-- see migration 0078's own comment on why relationship-based permissions
-- were kept separate from role ("This does NOT introduce a new
-- organization_members.role value... not a broader role with
-- organization-wide reach"). Growing `role` to add 'compensation_admin'
-- would make is_org_admin() — used throughout dozens of existing
-- policies — ambiguous about whether it also implies salary access, which
-- it explicitly must not.
--
-- Structural inverse of organization_feature_restrictions (0114): that
-- one is a deny-list with implicit default-allow (an org admin sees a
-- feature unless explicitly restricted). This is a grant-list with
-- implicit default-deny (nobody has compensation access unless a row
-- exists here) — the correct default for newly-added sensitive data.
create table if not exists public.organization_compensation_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.organization_compensation_admins enable row level security;

-- Deliberately gated on the org's OWNER (organizations.created_by, 0016),
-- not is_org_admin — an org can have any number of co-equal admins
-- (setMemberRole in lib/organizations/actions.ts lets any admin promote any
-- member to admin, no cap, no owner check), and any one of them being able
-- to grant themselves or a colleague salary-wide visibility defeats the
-- whole point of a narrow, deliberately-granted permission. Only the
-- person who created the workspace controls who else gets it. Plain
-- exists() — cannot throw on cardinality, same shape as is_org_admin.
create or replace function public.is_org_owner(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organizations
    where id = check_org_id and created_by = auth.uid()
  );
$$;

revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;

drop policy if exists "Org admins manage compensation admin grants" on public.organization_compensation_admins;
drop policy if exists "Org owner manages compensation admin grants" on public.organization_compensation_admins;
create policy "Org owner manages compensation admin grants"
  on public.organization_compensation_admins for all
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

-- A grantee can see their own grant row (so the UI can show "you have this
-- access") without being able to see or manage anyone else's.
drop policy if exists "Grantees can see their own compensation admin grant" on public.organization_compensation_admins;
create policy "Grantees can see their own compensation admin grant"
  on public.organization_compensation_admins for select
  using (user_id = auth.uid());

create index if not exists organization_compensation_admins_org_idx on public.organization_compensation_admins (organization_id);
