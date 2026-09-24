-- CRITICAL fix, found via live testing after 0154-0162 were applied (not a
-- pre-apply review this time — these are real bugs in the already-live
-- ownership-transfer feature). Direct REST/PostgREST calls with the public
-- anon key were used to probe the new schema; that testing surfaced this.
-- Two parts, same underlying pattern (a new sensitive column/behavior added
-- to a table that already had a broad, unrestricted-by-column policy):
-- Part 1 locks down organizations.owner_user_id et al.; Part 2 (below)
-- locks down organization_members role/membership changes for the owner
-- specifically.
--
-- organizations already had TWO broad UPDATE policies before 0162 ever
-- added owner_user_id/pending_owner_id/pending_owner_proposed_at to that
-- same table:
--   - "Org admins can update their own organization" (0033): using/with
--     check (is_org_admin(id)) — ANY org admin, not just the owner.
--   - "Platform admins can update organizations" (0079): using/with check
--     (is_admin()) — any Devometrics platform admin.
-- Neither policy restricts which COLUMNS an update can touch (Postgres RLS
-- policies are row-scoped, not column-scoped). That means, right now, ANY
-- org admin (or any platform admin) can bypass the entire two-step
-- propose/accept ownership-transfer flow (0162) and the owner-only gate on
-- granting Compensation Admin (0156) by issuing a single direct PATCH to
-- organizations.owner_user_id — e.g.
--   PATCH /rest/v1/organizations?id=eq.<org_id>  { "owner_user_id": "<self>" }
-- and instantly making themselves the workspace owner, no proposal, no
-- acceptance, no admin-only requirement on the target (trivially satisfied
-- since they're already an admin). This defeats the entire point of 0156/
-- 0162 — "master admin" control over who can grant salary-wide visibility
-- would otherwise have been exactly as permissive as before those
-- migrations, just with extra steps for the honest path.
--
-- Fix: Postgres column-level privileges are checked BEFORE row-level
-- security for UPDATE, so revoking UPDATE on just these three columns from
-- the roles those two policies actually apply to (authenticated, anon)
-- closes this regardless of which policy would otherwise have allowed the
-- row. This does NOT affect compensation_manager_visibility (0154) — that
-- column is deliberately still admin-writable via the existing
-- is_org_admin(id) policy, unchanged, since it was never meant to be
-- owner-restricted, only the Compensation Admin GRANT itself was.
--
-- The three transfer RPCs (propose/cancel/accept_ownership_transfer, 0162)
-- are unaffected — they're SECURITY DEFINER, so they run as the function's
-- owner role (not authenticated/anon), which still has full table
-- privileges. This remains the only legitimate write path to these columns
-- after this migration, which was always the intent.

revoke update (owner_user_id, pending_owner_id, pending_owner_proposed_at)
  on public.organizations from authenticated;
revoke update (owner_user_id, pending_owner_id, pending_owner_proposed_at)
  on public.organizations from anon;

-- Second half of the same finding: organization_members has its own two
-- pre-existing policies with the identical shape of gap.
--   - DELETE (0018/0153): using (user_id = auth.uid()) — self-only, no
--     role check at all. leaveOrganization() (lib/organizations/actions.ts)
--     blocks an admin from leaving in the APP, but that's a TS-layer check
--     only — a direct REST DELETE to this row bypasses it entirely. If the
--     row belongs to the org's owner, that's exactly the "stranded
--     owner_user_id pointing to someone no longer even a member" scenario
--     0162 tried to avoid, just reached a different way.
--   - UPDATE (0049): using/with check (is_org_admin(organization_id)) — any
--     admin, no column restriction. The "can't demote the owner" guard
--     just added to setMemberRole (lib/organizations/actions.ts) is
--     TS-layer only for the same reason — a direct REST PATCH setting
--     role='member' on the owner's row bypasses it.
--
-- Column-level revoke doesn't fit here (role changes are legitimate for
-- every OTHER row in this table) — a trigger that specifically protects
-- only the current owner's own row is the precise fix, closing both paths
-- without touching how any other member's role/membership is managed.
-- Deliberately scoped to owner-protection only, not a general rework of
-- this table's "app-layer-only" role-change enforcement (e.g. the
-- pre-existing "can't demote the last admin" check has the same shape of
-- gap, but that's a separate, out-of-scope decision).
create or replace function public.trg_protect_org_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_effective_owner uuid;
  v_org_id uuid;
  v_user_id uuid;
begin
  v_org_id := coalesce(new.organization_id, old.organization_id);
  v_user_id := coalesce(new.user_id, old.user_id);

  select coalesce(owner_user_id, created_by) into v_effective_owner
  from public.organizations where id = v_org_id limit 1;

  if v_effective_owner is distinct from v_user_id then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'This person owns the workspace — transfer ownership to someone else before they can leave.';
  end if;

  if tg_op = 'UPDATE' and new.role <> 'admin' then
    raise exception 'This person owns the workspace — transfer ownership to someone else before removing their admin access.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_org_owner_on_delete on public.organization_members;
create trigger protect_org_owner_on_delete
  before delete on public.organization_members
  for each row execute function public.trg_protect_org_owner_membership();

drop trigger if exists protect_org_owner_on_role_change on public.organization_members;
create trigger protect_org_owner_on_role_change
  before update on public.organization_members
  for each row execute function public.trg_protect_org_owner_membership();
