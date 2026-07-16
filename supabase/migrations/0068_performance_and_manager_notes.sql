-- Two genuinely new, optional data points, both direct management input —
-- never AI-inferred — that HiPo/succession decision support can now draw on
-- alongside the platform's own measured competency data:
--
-- 1) Performance rating — a single current value per person, same flat-field
--    pattern as title/department/manager_name (migration 0049). Already
--    covered by that migration's "Org admins can update member records" UPDATE
--    policy (scoped via is_org_admin on organization_members), so no new RLS
--    is needed here — this is purely additive columns.
--
-- 2) Manager notes — a running log, not a single field, so it gets its own
--    table (mirrors succession_nominations' note pattern, migration 0061).
--    Admin-authored, org-scoped, never visible to the employee themselves —
--    same "admin-only HR data" boundary as performance rating and every
--    other HR field on organization_members.
--
-- Both are optional everywhere they're read: the 9-box, HiPo pool, and
-- succession math are untouched by this migration — rating and notes are
-- surfaced as ADDITIONAL context (shown in the report, added as optional
-- lines in the succession/summary AI prompts when present), never a
-- required input or a silent change to existing scoring.

alter table public.organization_members
  add column if not exists performance_rating int check (performance_rating between 1 and 5),
  add column if not exists performance_rating_note text not null default '',
  add column if not exists performance_rating_updated_at timestamptz;

create table if not exists public.employee_manager_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.employee_manager_notes enable row level security;

drop policy if exists "Org admins manage manager notes" on public.employee_manager_notes;
create policy "Org admins manage manager notes"
  on public.employee_manager_notes for all
  using (public.is_org_admin_of_user(employee_user_id))
  with check (public.is_org_admin_of_user(employee_user_id));

create index if not exists employee_manager_notes_employee_idx on public.employee_manager_notes (employee_user_id, created_at desc);
