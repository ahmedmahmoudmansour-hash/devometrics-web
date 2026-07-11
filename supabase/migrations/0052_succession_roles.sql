-- Succession planning (first slice): org admins define critical roles and
-- the AI ranks current employees by fit — persisted so the report survives
-- reloads and regenerates on demand rather than on every page view.
create table if not exists public.succession_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  -- Latest AI ranking: { generatedAt, candidates: [{ userId, name, fitScore,
  --   readiness, strengths[], gaps[], developmentFocus, whyRanked }],
  --   riskNote, hasStrongSuccessor }
  report jsonb,
  generated_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.succession_roles enable row level security;

drop policy if exists "Org admins manage succession roles" on public.succession_roles;
create policy "Org admins manage succession roles"
  on public.succession_roles for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists succession_roles_org_idx on public.succession_roles (organization_id, created_at desc);
