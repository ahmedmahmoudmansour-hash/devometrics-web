-- ============================================================
-- DEVOMETRICS — PENDING MIGRATIONS IN ONE PASTE
-- 0089 (Smart Hiring follow-up — AI interview questions per job posting),
-- 0090 (per-organization AI usage tracking + budget enforcement),
-- 0091 (individual/non-org AI budget enforcement — closes the gap where
-- solo accounts had no spend cap, plus a real RLS fix on profiles' own
-- self-update policy), and 0092 (closes a further self-escalation gap that
-- 0091's fix left open — is_admin/subscription_tier/premium_trial_expires_at
-- were still writable by any user on their own row; only the budget column
-- was actually guarded), and 0093 (per-employee AI spend breakdown for the
-- platform-admin dashboard only — deliberately gated so it never becomes
-- visible to a company's own org-admin or its employees). Every statement
-- is idempotent (IF NOT EXISTS / CREATE OR REPLACE), so running this more
-- than once is safe. 0091 depends on 0090's ai_usage_events table and
-- 0013's is_admin() — both already earlier in this same file. 0092 depends
-- on 0091 having run first (it redefines the same policy again,
-- superseding it). 0093 depends on 0090's ai_usage_events table and
-- 0013's is_admin() too. Paste order is already correct as laid out below.
-- 0089 and 0090 don't depend on each other or on 0091/0092/0093. 0094 adds
-- an admin-read RLS policy on case_study_exercise_attempts (previously had
-- none at all) so org admins can see Case Study Exercise results once an
-- exercise is assigned via the existing assigned_assessments mechanism.
-- 0094 depends only on 0016's is_org_admin_of_user() and 0028's
-- case_study_exercise_attempts table, both from much earlier migrations
-- than this file — not on anything else pasted here. 0095 is a data fix,
-- not a schema change: backfills cost_usd for ai_usage_events rows that
-- were silently recorded as $0 due to a real bug (Anthropic's
-- claude-haiku-4-5 alias returns a dated snapshot string in the API
-- response that the pricing lookup didn't match) — depends only on
-- 0090's ai_usage_events table.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run.
-- ============================================================

-- ============================================================
-- 0089: Smart Hiring — AI interview questions per posting
-- ============================================================

-- Smart Hiring follow-up: AI-generated, competency-based interview
-- questions per posting. Closes a real gap in the original MVP — the flow
-- went straight from "CV scored" to "manager writes free-text notes" with
-- nothing in between to guide what to actually ask, so the notes (and the
-- AI assessment built from them) could end up thin or inconsistent across
-- interviewers. This gives every candidate for the same posting the same
-- baseline question set, generated from the posting's required
-- competencies (job_posting_competency_requirements) — decision support
-- for the interviewer to reference, never anything shown to a candidate.
--
-- Cached per posting (same pattern as ranking_report/ranking_generated_at,
-- added in 0088) rather than regenerated per candidate, since the
-- questions are a property of the role's requirements, not of any one
-- candidate.
alter table public.job_postings
  add column if not exists interview_questions jsonb,
  add column if not exists interview_questions_generated_at timestamptz;

-- ============================================================
-- 0090: Per-organization AI usage tracking & budget enforcement
-- ============================================================

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

-- ============================================================
-- 0091: Individual (non-org) AI budget enforcement
-- ============================================================

-- Mirrors organizations.monthly_ai_budget_usd (0090) on profiles, same
-- null-means-unlimited convention — assertOrgAiBudgetOk (now
-- assertAiBudgetOk, lib/aiUsage/track.ts) previously no-op'd unconditionally
-- for any account with no organization_id, meaning solo/individual users
-- had zero AI spend enforcement.
alter table public.profiles
  add column if not exists monthly_ai_budget_usd numeric(10,2);

-- Scalar aggregate (coalesce(sum(...),0) always returns exactly one row) —
-- same posture as org_ai_spend_this_month (0090); the 0083 postmortem
-- guard is for plpgsql multi-row select-into, which this isn't.
-- organization_id is null matters: an org member's personal (non-org)
-- spend must never be confused with their org's pooled spend.
create or replace function public.user_ai_spend_this_month(target_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage_events
  where user_id = target_user_id
    and organization_id is null
    and created_at >= date_trunc('month', now());
$$;

-- Closes a real gap the new column would otherwise open: profiles' only
-- self-update policy (0001_init.sql) is a blanket `auth.uid() = id` with no
-- `with check` clause at all, so without this a user could set their own
-- budget directly via the API, bypassing platform-admin control entirely.
-- Single PK-keyed scalar subquery — no multi-row select-into risk, so no
-- exception guard needed (same reasoning as the function above).
create or replace function public.profile_budget_change_allowed(target_user_id uuid, new_budget numeric)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or new_budget is not distinct from (
      select monthly_ai_budget_usd from public.profiles where id = target_user_id
    );
$$;

-- Redefines 0001_init.sql's policy of the same name to add the budget
-- restriction. Any other column update (full_name, career_stage, etc.)
-- still passes: an update statement that doesn't touch
-- monthly_ai_budget_usd leaves NEW.monthly_ai_budget_usd equal to the
-- stored value, which profile_budget_change_allowed treats as unchanged.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_budget_change_allowed(id, monthly_ai_budget_usd)
  );

-- profiles never had an admin WRITE policy before (0013's admin policy was
-- read-only: "Admins can view all profiles") — this is the first one, same
-- posture as 0079's equivalent grant on organizations.
drop policy if exists "Platform admins can update any profile" on public.profiles;
create policy "Platform admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 0092: Close self-escalation gap on profiles admin-controlled fields
-- ============================================================

-- 0091 added a `with check` to the profiles self-update policy, but it only
-- guarded monthly_ai_budget_usd. is_admin, subscription_tier, and
-- premium_trial_expires_at were left completely open — any authenticated
-- user could grant themselves platform admin or premium via a direct
-- client update (e.g. supabase.from('profiles').update({is_admin: true})),
-- bypassing both the documented "hand-flagged via SQL editor" admin
-- process (0013) and real billing entirely. This broadens the check to
-- cover all four admin-controlled columns with one helper, replacing
-- profile_budget_change_allowed.

create or replace function public.profile_admin_fields_unchanged(
  target_user_id uuid,
  new_is_admin boolean,
  new_subscription_tier text,
  new_premium_trial_expires_at timestamptz,
  new_monthly_ai_budget_usd numeric
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = target_user_id
        and new_is_admin is not distinct from p.is_admin
        and new_subscription_tier is not distinct from p.subscription_tier
        and new_premium_trial_expires_at is not distinct from p.premium_trial_expires_at
        and new_monthly_ai_budget_usd is not distinct from p.monthly_ai_budget_usd
    );
$$;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_admin_fields_unchanged(
      id, is_admin, subscription_tier, premium_trial_expires_at, monthly_ai_budget_usd
    )
  );

-- ============================================================
-- 0093: Per-employee AI spend breakdown, platform-admin only
-- ============================================================

-- org_ai_spend_this_month (0090) deliberately has no admin gate — it's a
-- single scalar sum any org member can call to check "can I proceed", not
-- sensitive on its own. A PER-EMPLOYEE breakdown is different: it reveals
-- individual usage patterns, which should only ever be visible to the
-- platform's own super-admin backend view (/dashboard/admin), never to a
-- company's own org-admin or its employees — per explicit product
-- decision, customers should only ever see an abstracted "credit" concept,
-- never real dollar figures or a colleague's usage. This function is
-- gated by is_admin() internally (not just by the calling UI), so it
-- returns zero rows for anyone who isn't a platform admin, regardless of
-- what eventually calls it.

create or replace function public.org_member_ai_spend_this_month(target_org_id uuid)
returns table(user_id uuid, cost_usd numeric)
language sql
security definer
set search_path = public
stable
as $$
  select e.user_id, coalesce(sum(e.cost_usd), 0) as cost_usd
  from public.ai_usage_events e
  where e.organization_id = target_org_id
    and e.created_at >= date_trunc('month', now())
    and e.user_id is not null
    and public.is_admin()
  group by e.user_id;
$$;

-- ============================================================
-- 0094: Case Study Exercise admin visibility
-- ============================================================

-- Case Study Exercises had no admin-read RLS policy at all -- migration
-- 0028 only granted the employee themselves read/write on their own rows
-- (auth.uid() = user_id). That's a real gap once an admin assigns an
-- exercise via the existing assigned_assessments mechanism (0058): the
-- admin's per-employee report page would query this table and get zero
-- rows back, no matter what the employee actually submitted, with no
-- error to explain why.
--
-- Same precedent as 0016's existing "Org admins can view their members'
-- assessment results" policy on assessment_results -- blanket visibility
-- into an org member's own attempts, not scoped to only
-- admin-assigned ones, for consistency with how every other
-- assessment-shaped table in this app already works. is_org_admin_of_user
-- (0016) is a plain `select exists(...)`, language sql function -- no
-- multi-row select-into risk, safe to reuse directly inside this policy.
drop policy if exists "Org admins can view their members' case study exercise attempts" on public.case_study_exercise_attempts;
create policy "Org admins can view their members' case study exercise attempts"
  on public.case_study_exercise_attempts for select
  using (public.is_org_admin_of_user(user_id));

-- ============================================================
-- 0095: Backfill Haiku cost_usd (real $0 bug, not a schema change)
-- ============================================================

-- Confirmed live: requesting "claude-haiku-4-5" from Anthropic returns
-- response.model = "claude-haiku-4-5-20251001", which the AI_USAGE_PRICING
-- map had no entry for -- every Coach/Roleplay call since the Haiku
-- migration recorded a real row with cost_usd = 0. App code is fixed
-- (computeCostUsd now strips a trailing -YYYYMMDD before the pricing
-- lookup); this repairs the rows already written wrong. Safe to run more
-- than once -- recomputes from stored token counts, doesn't apply a delta.
update public.ai_usage_events
set cost_usd = (input_tokens::numeric / 1000000) * 1.0 + (output_tokens::numeric / 1000000) * 5.0
where model = 'claude-haiku-4-5-20251001';
