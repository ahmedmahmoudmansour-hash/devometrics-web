-- Compensation Management follow-up: ownership transfer for the "master
-- admin" concept introduced in 0156 (is_org_owner, gating who can grant/
-- revoke Compensation Admin). Added during the same pre-apply review —
-- organizations.created_by (0016) has no transfer mechanism at all, and in
-- practice the account that creates a workspace during onboarding isn't
-- always the customer's actual designated owner (e.g. Devometrics setting
-- up structure on a new customer's behalf before handing it over). Without
-- this, "master admin" access would be permanently stuck on whichever
-- account happened to run signup.
--
-- owner_user_id is a SEPARATE column from created_by, not a repurposing of
-- it — created_by stays an honest historical fact (who actually created
-- this workspace), owner_user_id is the live, transferable pointer that
-- is_org_owner() actually checks. Backfilled from created_by so existing
-- behavior is unchanged until a transfer happens.
--
-- Two-step transfer (propose, then the NEW owner accepts), not an instant
-- one-sided handoff, mirroring organization_invites' (0017) accepted_at
-- pattern: control over who can see company-wide salary data is high
-- enough stakes that a typo'd instant transfer would be a real, hard-to-
-- undo mistake. The current owner keeps full control until the proposed
-- new owner actively accepts, and can cancel the proposal any time before
-- that. The target must already be an org admin — this can't hand
-- ultimate control to a stranger or a plain member, only to someone
-- already trusted with admin access.
--
-- Depends on 0156 (is_org_owner, organization_compensation_admins).

alter table public.organizations
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;
alter table public.organizations
  add column if not exists pending_owner_id uuid references auth.users (id) on delete set null;
alter table public.organizations
  add column if not exists pending_owner_proposed_at timestamptz;

-- Only fills genuinely-null values — safe to run more than once, and never
-- clobbers a real transfer that already happened.
update public.organizations set owner_user_id = created_by where owner_user_id is null;

-- Falls back to created_by if owner_user_id is ever null (e.g. the current
-- owner's account was deleted and nothing transferred ownership first) —
-- a workspace must never end up with literally nobody able to manage
-- Compensation Admin grants. Plain exists()/coalesce, cannot throw.
create or replace function public.is_org_owner(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organizations
    where id = check_org_id and coalesce(owner_user_id, created_by) = auth.uid()
  );
$$;

create or replace function public.propose_ownership_transfer(check_org_id uuid, new_owner_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_is_admin boolean;
begin
  if not public.is_org_owner(check_org_id) then
    raise exception 'Not authorized';
  end if;
  if new_owner_user_id = auth.uid() then
    raise exception 'Already the owner';
  end if;

  select exists (
    select 1 from public.organization_members
    where organization_id = check_org_id and user_id = new_owner_user_id and role = 'admin'
  ) into v_target_is_admin;
  if not v_target_is_admin then
    raise exception 'The new owner must already be an admin of this organization';
  end if;

  update public.organizations
  set pending_owner_id = new_owner_user_id, pending_owner_proposed_at = now()
  where id = check_org_id;

  return true;
end;
$$;

create or replace function public.cancel_ownership_transfer(check_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_owner(check_org_id) then
    raise exception 'Not authorized';
  end if;

  update public.organizations
  set pending_owner_id = null, pending_owner_proposed_at = null
  where id = check_org_id;

  return true;
end;
$$;

-- Only the proposed new owner can accept — never the current owner, never
-- anyone else. Flips owner_user_id atomically and clears the pending state
-- in the same statement.
create or replace function public.accept_ownership_transfer(check_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending uuid;
begin
  select pending_owner_id into v_pending from public.organizations where id = check_org_id limit 1;
  if v_pending is null or v_pending <> auth.uid() then
    raise exception 'No pending ownership transfer to you for this organization';
  end if;

  update public.organizations
  set owner_user_id = auth.uid(), pending_owner_id = null, pending_owner_proposed_at = null
  where id = check_org_id;

  return true;
end;
$$;

revoke all on function public.propose_ownership_transfer(uuid, uuid) from public;
grant execute on function public.propose_ownership_transfer(uuid, uuid) to authenticated;
revoke all on function public.cancel_ownership_transfer(uuid) from public;
grant execute on function public.cancel_ownership_transfer(uuid) to authenticated;
revoke all on function public.accept_ownership_transfer(uuid) from public;
grant execute on function public.accept_ownership_transfer(uuid) to authenticated;
