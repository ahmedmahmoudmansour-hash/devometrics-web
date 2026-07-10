-- ============================================================
-- DEVOMETRICS — ALL PENDING MIGRATIONS IN ONE PASTE
-- Combines 0048 + 0049 + 0050. Every statement is idempotent
-- (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS), so
-- running it more than once, or after part of it already ran,
-- is completely safe.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run.
-- ============================================================

-- === 0048: department/country on employees ===
alter table public.organization_invites
  add column if not exists department text,
  add column if not exists country text;

alter table public.organization_members
  add column if not exists department text,
  add column if not exists country text;

-- === 0049: Workspace notes, Career Paths, HR fields ===
create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
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

create table if not exists public.career_paths (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paths jsonb not null,
  generated_at timestamptz not null default now()
);

alter table public.career_paths enable row level security;

drop policy if exists "Users can manage their own career paths" on public.career_paths;
create policy "Users can manage their own career paths"
  on public.career_paths for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.organization_members
  add column if not exists manager_name text,
  add column if not exists business_unit text,
  add column if not exists location text,
  add column if not exists archived boolean not null default false;

alter table public.organization_invites
  add column if not exists manager_name text,
  add column if not exists business_unit text,
  add column if not exists location text;

-- No UPDATE policy existed on organization_members at all, so the HR
-- edit/archive controls would be silently blocked by RLS without this.
drop policy if exists "Org admins can update member records" on public.organization_members;
create policy "Org admins can update member records"
  on public.organization_members for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- === 0050: live calendar sync feed (Outlook/Google subscribe) ===
alter table public.profiles
  add column if not exists calendar_feed_token text unique;

create or replace function public.calendar_feed(feed_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tasks',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'title', t.title, 'date', t.date, 'time', t.time, 'completed', t.completed
        ) order by t.date)
        from public.personal_tasks t
        join public.profiles p on p.id = t.user_id
        where p.calendar_feed_token = feed_token
          and t.date >= (current_date - interval '30 days')
      ),
      '[]'::jsonb
    ),
    'milestones',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', m.id, 'title', m.title, 'date', m.target_date, 'completed', m.completed
        ) order by m.target_date)
        from public.milestones m
        join public.development_plans dp on dp.id = m.plan_id
        join public.profiles p on p.id = dp.user_id
        where p.calendar_feed_token = feed_token
          and m.target_date is not null
      ),
      '[]'::jsonb
    )
  )
  where feed_token is not null
    and length(feed_token) >= 32
    and exists (select 1 from public.profiles where calendar_feed_token = feed_token);
$$;

revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
