-- 0121: Org Chart structural snapshots + reset
--
-- Part 3 of the CEO's 2026-08-11 5-part program: "add more i can create new
-- chart after i save one so that i can redevelop new chart." Investigation
-- showed org_chart_saved_views (migration 0105) only stores DISPLAY config
-- (toggles/density/filters) — never the actual reporting-line structure —
-- so there was no way to preserve a past arrangement before redesigning.
-- This adds a real point-in-time structural snapshot (who reported to whom)
-- plus a reset action that clears the live tree back to a blank slate for a
-- redesign. Deliberately NOT a "restore" — re-applying a snapshot's edges
-- onto live data risks silently resurrecting stale manager references for
-- people who've since left; a snapshot is a read-only historical record,
-- not an undo point.

create table if not exists public.org_chart_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Shape: { members: [{ userId, name, title, managerUserId, managerPositionId }],
  -- positions: [{ id, title, kind, status, parentPositionId, parentMemberUserId }] }.
  -- Denormalized (name/title copied in, not just ids) so a snapshot stays
  -- meaningful to view even after the people/positions it references are
  -- later renamed, reassigned, or removed — same reasoning as every other
  -- point-in-time record in this schema (self-assessment snapshots,
  -- workflow step response payloads). Validated in TypeScript
  -- (lib/orgChart/snapshots.ts), not in Postgres, same posture as
  -- org_chart_saved_views.config.
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.org_chart_snapshots enable row level security;

drop policy if exists "Org admins can manage org chart snapshots" on public.org_chart_snapshots;
create policy "Org admins can manage org chart snapshots"
  on public.org_chart_snapshots for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view org chart snapshots" on public.org_chart_snapshots;
create policy "Org members can view org chart snapshots"
  on public.org_chart_snapshots for select
  using (public.is_org_member(organization_id));

create index if not exists org_chart_snapshots_org_idx on public.org_chart_snapshots (organization_id);

-- Clears the live reporting-line tree back to a blank slate for a redesign.
-- Does NOT delete org_positions rows — only clears parent_position_id/
-- parent_member_user_id — so a planned-but-vacant role (e.g. a Job
-- Architecture-linked opening) survives a reset instead of being silently
-- destroyed. Atomic (one RPC, not a client-side loop) specifically so a
-- failure can't leave the chart half-reset. SECURITY DEFINER + explicit
-- is_org_admin check, same posture as delete_org_position/fill_org_position
-- (migration 0106).
create or replace function public.reset_org_chart(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(target_organization_id) then
    raise exception 'not authorized';
  end if;

  update public.organization_members
    set manager_user_id = null,
        manager_position_id = null
    where organization_id = target_organization_id;

  update public.org_positions
    set parent_position_id = null,
        parent_member_user_id = null,
        updated_at = now()
    where organization_id = target_organization_id;
end;
$$;

grant execute on function public.reset_org_chart(uuid) to authenticated;
