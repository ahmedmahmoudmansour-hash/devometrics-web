-- Real reporting lines — the foundation the Org Chart Builder needs.
-- manager_name/manager_email (migration 0049) stay exactly as they are:
-- free-text hints filled in during invite/bulk-import, often for a manager
-- who hasn't signed up yet. manager_user_id is the NEW, structured
-- relationship — a real FK to another member of the same org — that the
-- chart actually renders and edits. The two are independent; nothing
-- auto-links them, since a text name matching a real account is not
-- something to assume silently.
--
-- Already covered by migration 0049's "Org admins can update member
-- records" UPDATE policy (scoped via is_org_admin on organization_members)
-- — no new RLS needed, same reasoning as performance_rating (0068).

alter table public.organization_members
  add column if not exists manager_user_id uuid references auth.users(id) on delete set null;

-- A person can't be their own manager — this one invariant is cheap to
-- enforce at the database level. Multi-hop cycles (A manages B manages A)
-- can't be expressed as a single-row CHECK constraint; that guard lives in
-- the application (lib/orgChart/actions.ts walks the chain before saving),
-- same division of labor as everywhere else in this schema between "the
-- database enforces what's structurally cheap" and "the app enforces what
-- needs a traversal."
alter table public.organization_members
  drop constraint if exists organization_members_manager_not_self;
alter table public.organization_members
  add constraint organization_members_manager_not_self
  check (manager_user_id is null or manager_user_id != user_id);

create index if not exists organization_members_manager_idx on public.organization_members (manager_user_id);
