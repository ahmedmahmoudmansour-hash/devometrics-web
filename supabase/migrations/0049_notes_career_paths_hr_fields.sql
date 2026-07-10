-- Phase-1 batch: Personal AI Workspace notes, Career Paths persistence,
-- and richer HR employee records. Bundled into one migration so it can be
-- run in the Supabase SQL Editor in a single paste.

-- 1) Personal AI Workspace — private notes the AI can organize/summarize.
-- Same privacy stance as personal_tasks (0043): employee-private, no org
-- admin SELECT policy, by design.
create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  -- Last AI pass over this note, persisted so reopening the note doesn't
  -- re-bill a Claude call: { summary: string, actionItems: string[] }
  ai_insight jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_notes enable row level security;

drop policy if exists "Users can manage their own notes" on public.personal_notes;
create policy "Users can manage their own notes"
  on public.personal_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists personal_notes_user_idx on public.personal_notes (user_id, updated_at desc);

-- 2) Career Paths — persisted AI-generated career map so the signature
-- Career Journey view loads instantly instead of re-generating (and
-- re-billing) on every visit. One current map per user; regeneration
-- replaces it.
create table if not exists public.career_paths (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- { currentRole: string, branches: [{ name, description, nodes: [{ role,
  --   readinessPercent, requiredSkills[], gaps[], estimatedTime,
  --   whyThisPath }] }] }
  paths jsonb not null,
  generated_at timestamptz not null default now()
);

alter table public.career_paths enable row level security;

drop policy if exists "Users can manage their own career paths" on public.career_paths;
create policy "Users can manage their own career paths"
  on public.career_paths for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3) Richer HR employee records (manager, business unit, location) plus
-- archiving — archived members stay in the table for history but drop out
-- of workforce views and aggregates.
alter table public.organization_members
  add column if not exists manager_name text,
  add column if not exists business_unit text,
  add column if not exists location text,
  add column if not exists archived boolean not null default false;

alter table public.organization_invites
  add column if not exists manager_name text,
  add column if not exists business_unit text,
  add column if not exists location text;

-- No UPDATE policy existed on organization_members at all, so the new HR
-- edit/archive controls would be silently blocked by RLS. Scoped to admins
-- of the member's own organization via the existing is_org_admin helper.
drop policy if exists "Org admins can update member records" on public.organization_members;
create policy "Org admins can update member records"
  on public.organization_members for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
