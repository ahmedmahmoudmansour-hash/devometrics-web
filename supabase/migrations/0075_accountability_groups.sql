-- Peer accountability / study groups — individual-experience feature.
-- Deliberately NOT an org-admin feature: any user creates or joins a small
-- group via a share code, same posture as joinOrganization's slug-based
-- flow (0016), and admins have no special visibility into group content.
create table if not exists public.accountability_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.accountability_group_members (
  group_id uuid not null references public.accountability_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.accountability_checkins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.accountability_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.accountability_groups enable row level security;
alter table public.accountability_group_members enable row level security;
alter table public.accountability_checkins enable row level security;

-- SECURITY DEFINER to break the circular RLS reference: the groups policy
-- needs to check membership, and the members policy needs to check
-- membership too — same class of problem (and same fix) as
-- is_org_admin/is_assigned_to_survey elsewhere in this schema.
create or replace function public.is_accountability_group_member(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.accountability_group_members
    where group_id = target_group_id and user_id = target_user_id
  );
$$;

-- Deliberately NOT "any authenticated user can look up any group" (unlike
-- organizations' slug lookup, 0016) — a study group's name isn't harmless
-- the way a company name is; opening SELECT to everyone would let anyone
-- enumerate every group on the platform. Instead, joining goes through a
-- SECURITY DEFINER lookup-by-code function below, which only returns a
-- match for someone who already has the exact code.
drop policy if exists "Members can view their groups" on public.accountability_groups;
create policy "Members can view their groups"
  on public.accountability_groups for select
  using (is_accountability_group_member(id, auth.uid()) or created_by = auth.uid());

drop policy if exists "Authenticated users can create groups" on public.accountability_groups;
create policy "Authenticated users can create groups"
  on public.accountability_groups for insert
  with check (created_by = auth.uid());

drop policy if exists "Creator can update their group" on public.accountability_groups;
create policy "Creator can update their group"
  on public.accountability_groups for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Creator can delete their group" on public.accountability_groups;
create policy "Creator can delete their group"
  on public.accountability_groups for delete
  using (created_by = auth.uid());

drop policy if exists "Members can view group roster" on public.accountability_group_members;
create policy "Members can view group roster"
  on public.accountability_group_members for select
  using (is_accountability_group_member(group_id, auth.uid()));

drop policy if exists "Users can join a group" on public.accountability_group_members;
create policy "Users can join a group"
  on public.accountability_group_members for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can leave a group" on public.accountability_group_members;
create policy "Users can leave a group"
  on public.accountability_group_members for delete
  using (user_id = auth.uid());

drop policy if exists "Members can view group checkins" on public.accountability_checkins;
create policy "Members can view group checkins"
  on public.accountability_checkins for select
  using (is_accountability_group_member(group_id, auth.uid()));

drop policy if exists "Members can post their own checkins" on public.accountability_checkins;
create policy "Members can post their own checkins"
  on public.accountability_checkins for insert
  with check (user_id = auth.uid() and is_accountability_group_member(group_id, auth.uid()));

drop policy if exists "Members can delete their own checkins" on public.accountability_checkins;
create policy "Members can delete their own checkins"
  on public.accountability_checkins for delete
  using (user_id = auth.uid());

-- Lookup-by-code for the join flow, returning only what's needed to show a
-- confirmation ("Join Product Design Study Group? 4 members") before the
-- actual membership insert — never a broad group listing.
create or replace function public.find_accountability_group_by_code(code text)
returns table(id uuid, name text, description text, member_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select g.id, g.name, g.description, count(m.user_id)
  from public.accountability_groups g
  left join public.accountability_group_members m on m.group_id = g.id
  where g.invite_code = code
  group by g.id, g.name, g.description;
$$;

revoke all on function public.find_accountability_group_by_code(text) from public;
grant execute on function public.find_accountability_group_by_code(text) to authenticated;

create index if not exists accountability_group_members_user_idx on public.accountability_group_members (user_id);
create index if not exists accountability_checkins_group_idx on public.accountability_checkins (group_id, created_at desc);

-- profiles' own RLS only allows self, platform admins, and org-admins-of-
-- their-members to read a row (0001/0013/0016) — a fellow accountability
-- group member is none of those, so a plain join from the client would come
-- back empty. This exposes exactly name + avatar (nothing else on the
-- profiles row) and only to a caller who is themselves in the same group.
create or replace function public.get_accountability_group_member_profiles(target_group_id uuid)
returns table(user_id uuid, full_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url
  from public.profiles p
  join public.accountability_group_members m on m.user_id = p.id
  where m.group_id = target_group_id
    and public.is_accountability_group_member(target_group_id, auth.uid());
$$;

revoke all on function public.get_accountability_group_member_profiles(uuid) from public;
grant execute on function public.get_accountability_group_member_profiles(uuid) to authenticated;
