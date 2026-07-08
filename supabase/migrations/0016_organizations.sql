-- Real multi-tenant Corporate/Enterprise support. Each company only ever
-- sees its own members' data — this is deliberately NOT the same pattern as
-- is_admin() in 0013 (a single flat "sees everyone" pilot-tracking role).
-- That flat pattern is fine for a single-owner pilot cohort; it would be a
-- real data leak across companies once more than one org exists, so org
-- visibility is scoped by organization membership at every step.

-- Tracks which signup path a user chose, so the app can prompt a
-- company-only user to finish org setup (create/join) after their first
-- login, regardless of whether email confirmation was required in between.
alter table public.profiles
  add column if not exists account_type text not null default 'individual' check (account_type in ('individual', 'company'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, account_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'individual')
  );
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.organization_members enable row level security;

-- security definer avoids RLS self-recursion when these are called from
-- policies defined on organization_members / organizations themselves.
create or replace function public.is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = check_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = check_org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- The key cross-table check: is auth.uid() an admin of an org that
-- target_user_id also belongs to? This is what makes HR-dashboard queries
-- against gap_analyses/assessment_results/etc. safe — it only ever matches
-- rows for people who share an organization with the requesting admin,
-- never a global "see everyone" grant.
create or replace function public.is_org_admin_of_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members admin_m
    join public.organization_members target_m
      on target_m.organization_id = admin_m.organization_id
    where admin_m.user_id = auth.uid()
      and admin_m.role = 'admin'
      and target_m.user_id = target_user_id
  );
$$;

-- Any authenticated user can look up any organization by id/slug — nothing
-- sensitive lives on this row (name + invite slug only), and the join-by-
-- invite-code flow needs to find an org by slug before the user has any
-- membership in it yet. Also covers the insert's own .select() returning
-- the row immediately after creation, before the membership row exists.
create policy "Authenticated users can look up organizations"
  on public.organizations for select
  using (auth.uid() is not null);

-- Any authenticated user can create a new organization (becomes its
-- creator); membership/admin role is granted separately by the insert
-- policy on organization_members below, which checks created_by itself
-- rather than trusting the client to only do this once.
create policy "Authenticated users can create an organization"
  on public.organizations for insert
  with check (auth.uid() = created_by);

create policy "Members can view fellow members of their own organization"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- Two safe ways to insert a membership row for yourself:
-- 1) as the admin of an org you just created (created_by = you), or
-- 2) as a plain member joining an existing org via its invite slug (the
--    join flow only ever inserts role = 'member', enforced here, not just
--    in application code, so someone can't grant themselves admin over an
--    org they didn't create).
create policy "Users can join an organization as themselves"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      (role = 'admin' and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      ))
      or role = 'member'
    )
  );

-- Org-admin visibility into their own members' individual data, scoped to
-- same-organization membership only — not a blanket is_admin() grant.
create policy "Org admins can view their members' gap analyses"
  on public.gap_analyses for select
  using (public.is_org_admin_of_user(user_id));

create policy "Org admins can view their members' assessment results"
  on public.assessment_results for select
  using (public.is_org_admin_of_user(user_id));

create policy "Org admins can view their members' development plans"
  on public.development_plans for select
  using (public.is_org_admin_of_user(user_id));

create policy "Org admins can view their members' milestones"
  on public.milestones for select
  using (
    exists (
      select 1 from public.development_plans p
      where p.id = milestones.plan_id and public.is_org_admin_of_user(p.user_id)
    )
  );

create policy "Org admins can view their members' resume analyses"
  on public.resume_analyses for select
  using (public.is_org_admin_of_user(user_id));

create policy "Org admins can view their members' profiles"
  on public.profiles for select
  using (public.is_org_admin_of_user(id));

create index if not exists organization_members_org_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_idx on public.organization_members (user_id);
