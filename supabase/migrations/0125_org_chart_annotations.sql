-- 0125: Org Chart free-floating text notes — persisted separately from
-- org_chart_saved_views on purpose. That table's own migration (0105)
-- documents it stores ONLY toggle/density/filter/preset config and
-- explicitly NEVER raw node x/y positions, since the tidy-tree layout is
-- always recomputed at render time. A note's x/y IS its actual content
-- (where you dropped it), not layout geometry to recompute, so it needs a
-- home that doesn't carry that "never positions" invariant.
--
-- One row per org (organization_id is the primary key, not a separate uuid
-- id) — there is exactly one always-on notes layer per company, shown
-- regardless of which saved view/department filter is currently active,
-- not a per-view thing. Same "org-wide, admin-authored, member-readable"
-- visibility posture as org_chart_saved_views (0105).

create table if not exists public.org_chart_annotations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  -- Array of { id: string, text: string, x: number, y: number }. Validated
  -- in TypeScript (lib/orgChart/cardConfig.ts's OrgChartAnnotation), not in
  -- Postgres — same posture as every other config-shaped jsonb column in
  -- this schema.
  annotations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.org_chart_annotations enable row level security;

drop policy if exists "Org admins can manage org chart annotations" on public.org_chart_annotations;
create policy "Org admins can manage org chart annotations"
  on public.org_chart_annotations for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart annotations" on public.org_chart_annotations;
create policy "Org members can view org chart annotations"
  on public.org_chart_annotations for select
  using (public.is_org_member(organization_id));
