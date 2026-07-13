-- Manual succession nomination: lets an admin guarantee a specific
-- employee is scored for a critical role even if the AI's own judgment
-- wouldn't have surfaced them on its own — a human call the AI ranking
-- alone can't make. Nominees are merged into the next
-- generateSuccessionReport run (lib/succession/actions.ts) and tagged
-- `nominated: true` in the stored report, so the UI can explain why a
-- lower fit score is still in the list.
create table if not exists public.succession_nominations (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.succession_roles(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  nominated_by uuid not null references auth.users(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (role_id, employee_user_id)
);

alter table public.succession_nominations enable row level security;

drop policy if exists "Org admins manage succession nominations" on public.succession_nominations;
create policy "Org admins manage succession nominations"
  on public.succession_nominations for all
  using (
    exists (
      select 1 from public.succession_roles sr
      where sr.id = role_id and public.is_org_admin(sr.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.succession_roles sr
      where sr.id = role_id and public.is_org_admin(sr.organization_id)
    )
  );

create index if not exists succession_nominations_role_idx on public.succession_nominations (role_id);

-- Readiness forecasting needs to read a candidate's Career Health Score
-- history, which today only has a "view your own" policy (0040) — admins
-- can't read a member's trend at all yet. Same is_org_admin_of_user()
-- scoping already used for gap analyses, assessment results, and assigned
-- assessments (0016/0058): admin-of-their-own-org only, never a global
-- "see everyone" grant.
drop policy if exists "Org admins can view their members' career health snapshots" on public.career_health_snapshots;
create policy "Org admins can view their members' career health snapshots"
  on public.career_health_snapshots for select
  using (public.is_org_admin_of_user(user_id));
