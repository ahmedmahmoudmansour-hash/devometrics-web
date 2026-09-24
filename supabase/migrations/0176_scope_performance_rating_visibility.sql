-- Closes a real over-exposure gap: organization_members.performance_rating/
-- performance_rating_note/performance_rating_updated_at (migration 0068)
-- lived on organization_members, whose own SELECT policy
-- ("Members can view fellow members of their own organization", 0016/0145)
-- deliberately grants every org member read access to every other member's
-- ROW for legitimate reasons (name/title/department directory-style
-- lookups) -- but RLS is row-level, not column-level, so that same broad
-- row visibility also exposed manager-entered performance ratings and
-- notes to any peer who queried the table directly (not just through the
-- app UI, which never surfaced this to non-admins, but RLS -- not the UI
-- -- is this app's real security boundary; see the devometrics-migrations
-- skill's own header on this). The write side was already correctly
-- admin-only (0049's UPDATE policy); only reads were too broad.
--
-- Fix: move these three fields into their own table with real RLS (org
-- admin only -- the same scope employee_performance_rating_history, 0099,
-- already uses for the exact same kind of data, and the scope
-- updateMemberPerformance's write path already enforced). Existing values
-- are copied over before the old columns are dropped, in the same
-- migration, so there's no window where the data exists in both places or
-- neither.

create table if not exists public.organization_member_performance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.organization_members (id) on delete cascade,
  employee_user_id uuid not null references auth.users (id) on delete cascade,
  rating integer check (rating between 1 and 5),
  note text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (member_id)
);

alter table public.organization_member_performance enable row level security;

drop policy if exists "Org admins manage performance ratings" on public.organization_member_performance;
create policy "Org admins manage performance ratings"
  on public.organization_member_performance for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create index if not exists organization_member_performance_org_idx on public.organization_member_performance (organization_id);

-- Copy forward before dropping the source columns. Only rows that ever had
-- a rating or a note are worth carrying over -- an all-default row (null
-- rating, empty note) is indistinguishable from "never touched", which is
-- exactly what "no row" already means in the new table.
insert into public.organization_member_performance (organization_id, member_id, employee_user_id, rating, note, updated_at)
select organization_id, id, user_id, performance_rating, coalesce(performance_rating_note, ''), coalesce(performance_rating_updated_at, now())
from public.organization_members
where performance_rating is not null or coalesce(performance_rating_note, '') <> ''
on conflict (member_id) do nothing;

alter table public.organization_members
  drop column if exists performance_rating,
  drop column if exists performance_rating_note,
  drop column if exists performance_rating_updated_at;
