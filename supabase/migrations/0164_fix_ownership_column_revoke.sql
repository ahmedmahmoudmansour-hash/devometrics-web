-- Fixes a mistake in 0163's Part 1, found via live re-testing after 0163
-- was confirmed applied: `revoke update (col) on organizations from role`
-- only removes a privilege that was granted at the COLUMN level. This
-- project's baseline setup grants UPDATE on organizations at the TABLE
-- level to anon/authenticated (confirmed via information_schema.
-- column_privileges: anon still shows UPDATE on owner_user_id after 0163
-- ran successfully). A column-specific revoke against a role that only
-- ever held the privilege via a table-level grant is a silent no-op — it
-- runs without error and changes nothing. 0163's organization_members
-- trigger fix (Part 2) is unaffected by this and remains correct; only
-- the organizations column lockdown needs replacing.
--
-- Fix: the same mechanism already used for organization_members — a
-- trigger, not a grant. A BEFORE UPDATE trigger blocks any change to
-- owner_user_id/pending_owner_id/pending_owner_proposed_at UNLESS a
-- transaction-local flag is set, and only propose/cancel/accept_
-- ownership_transfer (SECURITY DEFINER, 0162) ever set that flag,
-- immediately before their own UPDATE. A direct REST/SQL PATCH from any
-- other caller — any org admin, any platform admin, anon — never sets it,
-- so the trigger blocks them regardless of which of organizations' two
-- existing broad UPDATE policies (0033 is_org_admin, 0079 is_admin) would
-- otherwise have allowed the row. set_config's third argument (true) scopes
-- the flag to the current transaction only, so it can never leak into or
-- accidentally authorize a later, unrelated request.
--
-- 0163's now-proven-ineffective revoke statements are left in place
-- (harmless no-ops, not worth a migration to remove) — this trigger is
-- the real boundary going forward.
--
-- Depends on 0162 (owner_user_id/pending_owner_id columns, the three
-- transfer functions being replaced here).

create or replace function public.trg_protect_organization_ownership_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.owner_user_id is distinct from old.owner_user_id
    or new.pending_owner_id is distinct from old.pending_owner_id
    or new.pending_owner_proposed_at is distinct from old.pending_owner_proposed_at
  ) and coalesce(current_setting('app.allow_ownership_column_write', true), 'false') <> 'true' then
    raise exception 'owner_user_id/pending_owner_id can only be changed via the ownership-transfer functions';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_ownership_columns on public.organizations;
create trigger protect_organization_ownership_columns
  before update on public.organizations
  for each row execute function public.trg_protect_organization_ownership_columns();

-- Re-defined only to add the one-line set_config() flag immediately before
-- each function's own UPDATE — every other line is unchanged from 0162.
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

  perform set_config('app.allow_ownership_column_write', 'true', true);
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

  perform set_config('app.allow_ownership_column_write', 'true', true);
  update public.organizations
  set pending_owner_id = null, pending_owner_proposed_at = null
  where id = check_org_id;

  return true;
end;
$$;

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

  perform set_config('app.allow_ownership_column_write', 'true', true);
  update public.organizations
  set owner_user_id = auth.uid(), pending_owner_id = null, pending_owner_proposed_at = null
  where id = check_org_id;

  return true;
end;
$$;
