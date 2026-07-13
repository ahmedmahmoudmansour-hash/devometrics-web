-- AI-written narrative for the employee report — the difference between a
-- data dump (charts and numbers) and something that reads like a real
-- assessment-center report (an analyst's interpretation of the data). One
-- row per employee, regenerated on demand (not automatically, since it's
-- a real Claude call) and cached here rather than computed on every page
-- view or PDF export.
create table if not exists public.employee_assessment_summaries (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null unique references auth.users(id) on delete cascade,
  -- { overallSummary, keyStrengths[], developmentPriorities[], standingNote }
  summary jsonb not null,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.employee_assessment_summaries enable row level security;

-- Same is_org_admin_of_user() scoping as gap analyses, assessment results,
-- and assigned assessments (0016/0058) — an admin can only generate and
-- read summaries for their own org's members.
drop policy if exists "Org admins manage employee assessment summaries" on public.employee_assessment_summaries;
create policy "Org admins manage employee assessment summaries"
  on public.employee_assessment_summaries for all
  using (public.is_org_admin_of_user(employee_user_id))
  with check (public.is_org_admin_of_user(employee_user_id));
