-- 0105: Org Chart saved views — Workstream 6 of the 2026-08-03 strategic
-- memo (the Org Chart rebuild: drag-and-drop reporting-line editing, card
-- field-visibility toggles/presets, country/business-unit/department
-- filtering, named saved views, print export).
--
-- This is the ONLY schema change the rebuild needs — everything else
-- (drag-and-drop reparenting, filtering, display toggles, depth-capping,
-- print export) is either reusing existing tables/RLS (organization_members,
-- setMemberManager, employee_role_change_history) unchanged, or is pure
-- client-side/UI state that is never persisted at all.
--
-- Same "org-wide, admin-authored, member-readable" visibility posture as
-- onboarding_templates (0102) and performance_review_workflow_templates
-- (0103) — no precedent anywhere in this schema for a private-per-admin
-- view, so this doesn't introduce one; a saved view any admin creates is
-- usable by every admin in the org.
--
-- Stores ONLY the toggle/density/depth-cap/filter/preset config as jsonb —
-- NEVER raw node x/y positions. The tidy-tree auto-layout algorithm
-- (lib/orgChart/tree.ts) always computes actual card positions at render
-- time from the live reporting-line data; nothing about layout geometry is
-- ever persisted here, so a saved view never goes stale relative to who
-- actually reports to whom.

create table if not exists public.org_chart_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Shape: { toggles: { showPhoto, showName, showTitle, showDepartment,
  -- showLocation, showTenure, showPerformanceBadge, showSuccessionStatus },
  -- density: 'comfortable'|'compact', maxDepth: number|null,
  -- filters: { countries: string[], businessUnits: string[], departments: string[] },
  -- presetKey: string|null }. Validated in TypeScript
  -- (lib/orgChart/cardConfig.ts), not in Postgres — same posture as every
  -- other config-shaped jsonb column added this project (workflow step
  -- data, custom-step response payloads).
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.org_chart_saved_views enable row level security;

drop policy if exists "Org admins can manage org chart saved views" on public.org_chart_saved_views;
create policy "Org admins can manage org chart saved views"
  on public.org_chart_saved_views for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart saved views" on public.org_chart_saved_views;
create policy "Org members can view org chart saved views"
  on public.org_chart_saved_views for select
  using (public.is_org_member(organization_id));

create index if not exists org_chart_saved_views_org_idx on public.org_chart_saved_views (organization_id);
