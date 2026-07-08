-- Lets an enterprise workspace define its own competency framework (its own
-- names/descriptions — e.g. "Customer Obsession") and map each one onto one
-- of the platform's 8 fixed dimensions. The fixed 8 stay the actual scoring
-- engine (that's what keeps Career Health Score/Skill Radar comparable
-- across everyone); this table is a translation layer on top, not a second
-- scoring system.
create table if not exists public.organization_competencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  mapped_dimension text not null,
  created_at timestamptz not null default now()
);

alter table public.organization_competencies enable row level security;

-- Any member of the org can view the framework (it's just labels), but only
-- an admin can create/edit/delete it — same admin-vs-member split already
-- used throughout the organizations schema.
drop policy if exists "Org members can view their org's competency framework" on public.organization_competencies;
create policy "Org members can view their org's competency framework"
  on public.organization_competencies for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins can manage their org's competency framework" on public.organization_competencies;
create policy "Org admins can manage their org's competency framework"
  on public.organization_competencies for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists organization_competencies_org_idx on public.organization_competencies (organization_id);
