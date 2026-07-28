-- Per-organization AI usage tracking & budget enforcement.
--
-- Ahmed's concern: a company (e.g. 400 employees) could consume far more AI
-- tokens than expected via Coach, Roleplay, and bulk CV scoring, with no way
-- to see or cap real dollar cost per client. A repo-wide audit found zero
-- token/cost tracking anywhere (36 Anthropic call sites, none reading
-- response.usage). This adds: a platform-admin-assigned monthly USD budget
-- per organization (same null-means-unlimited convention as seat_limit,
-- migration 0079), an append-only usage-event log, and a spend-lookup
-- function the app calls before a gated AI call to hard-block once a client
-- exceeds its budget — mirroring org_seat_limit_ok's exact mechanism.
--
-- v1 gates only the three highest-volume/highest-risk paths (Coach,
-- Roleplay, Smart Hiring CV scoring) — see lib/aiUsage/track.ts. The other
-- ~33 AI call sites can log usage later via the same recordAiUsage() helper
-- without any schema change.

alter table public.organizations
  add column if not exists monthly_ai_budget_usd numeric(10,2);
-- No new UPDATE policy needed — 0079's "Platform admins can update
-- organizations" policy already covers every column on this table.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_org_created_idx
  on public.ai_usage_events(organization_id, created_at);

alter table public.ai_usage_events enable row level security;

-- Any authenticated user logs their own usage — organization_id is null for
-- individual (non-org) accounts using Coach/Roleplay personally, so there's
-- no shared budget to attribute it to.
drop policy if exists "Users log their own AI usage" on public.ai_usage_events;
create policy "Users log their own AI usage"
  on public.ai_usage_events for insert
  with check (auth.uid() = user_id);

-- Org admins can see the raw per-event log (feature/model/cost detail) for
-- their own org — same admin-only visibility posture as member/seat
-- management elsewhere in this app. Regular members don't need row-level
-- read access: the budget-check function below is security definer and
-- doesn't require it.
drop policy if exists "Org admins read their org's AI usage" on public.ai_usage_events;
create policy "Org admins read their org's AI usage"
  on public.ai_usage_events for select
  using (organization_id is not null and public.is_org_admin(organization_id));

-- Scalar aggregate (coalesce(sum(...), 0) always returns exactly one row),
-- so this doesn't need the "exception when others" guard from the 0083
-- postmortem — that guard is specifically for plpgsql functions with an
-- unguarded multi-row `select into`, which this isn't. security definer
-- lets any org member call this to check "can I proceed" without being
-- granted broad read access to the detailed event log.
create or replace function public.org_ai_spend_this_month(target_org_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage_events
  where organization_id = target_org_id
    and created_at >= date_trunc('month', now());
$$;
