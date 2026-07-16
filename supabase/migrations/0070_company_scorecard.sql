-- Company Scorecard — the classic Kaplan & Norton Balanced Scorecard, 4
-- perspectives. Learning & Growth is deliberately NOT a table here: it's
-- computed live from data this platform already has (Gap Analysis
-- coverage, assessment participation, average Career Health Score,
-- development-plan completion, High Potential bench strength) — no schema
-- needed, and it can never drift stale the way a manually-entered number
-- would. Customer, Internal Process, and Financial genuinely need data this
-- platform doesn't hold (a CRM, an ops system, an ERP), so those three are
-- flexible admin-entered KPIs: free-text target/actual (a KPI might be
-- "$450K MRR" or "12 days" or "94% CSAT" — forcing numeric+unit fields
-- would be more rigid than real BSC practice needs) with an explicit
-- status the admin sets alongside the numbers, since auto-deriving
-- "on track" from arbitrary free text isn't reliable.

create table if not exists public.scorecard_kpis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  perspective text not null check (perspective in ('customer', 'process', 'financial')),
  name text not null,
  target text not null default '',
  actual text not null default '',
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'off_track')),
  note text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scorecard_kpis enable row level security;

drop policy if exists "Org admins manage scorecard KPIs" on public.scorecard_kpis;
create policy "Org admins manage scorecard KPIs"
  on public.scorecard_kpis for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists scorecard_kpis_org_idx on public.scorecard_kpis (organization_id, perspective, created_at desc);
