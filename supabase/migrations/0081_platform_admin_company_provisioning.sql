-- Lets a platform (super) admin provision a brand-new company workspace
-- from the backend — name, seat count, basic profile — and hand it off to
-- the company's actual admin, without the platform admin ever becoming a
-- member of that org themselves. This app has no service-role key, so the
-- platform admin still creates the org row as themselves (created_by =
-- their own uid, already permitted by 0016's "Authenticated users can
-- create an organization" policy) and the real admin claims it by signing
-- up against a pre-authorized invite — same "invite, don't impersonate"
-- shape as employee invites (0017), just for the founding admin seat.

-- Distinguishes "join an existing team as staff" from "become the founding
-- admin of a workspace someone already provisioned for you" — same table,
-- one more column, so bulkInviteEmployees/inviteEmployee callers are
-- unaffected by the default.
alter table public.organization_invites
  add column if not exists intended_role text not null default 'member';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'organization_invites'
      and constraint_name = 'organization_invites_intended_role_check'
  ) then
    alter table public.organization_invites
      add constraint organization_invites_intended_role_check
      check (intended_role in ('member', 'admin'));
  end if;
end $$;

-- Platform admins need to write invites for organizations they didn't
-- create and aren't a member of — the existing "Org admins can manage
-- invites for their organization" policy (is_org_admin-gated) doesn't
-- cover that. Same precedent as 0079's platform-admin write grant on
-- organizations itself.
drop policy if exists "Platform admins can manage any organization's invites" on public.organization_invites;
create policy "Platform admins can manage any organization's invites"
  on public.organization_invites for all
  using (public.is_admin())
  with check (public.is_admin());

-- Adds a third way to self-insert as 'admin': a platform-admin-provisioned,
-- not-yet-accepted invite addressed to your own verified email. Mirrors the
-- existing created_by = auth.uid() branch (self-serve signup) rather than
-- replacing it.
drop policy if exists "Users can join an organization as themselves" on public.organization_members;
create policy "Users can join an organization as themselves"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      (role = 'admin' and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.created_by = auth.uid()
      ))
      or (role = 'admin' and exists (
        select 1 from public.organization_invites i
        where i.organization_id = organization_id
          and i.intended_role = 'admin'
          and i.accepted_at is null
          and lower(i.email) = lower(auth.jwt() ->> 'email')
      ))
      or (role = 'member' and public.org_seat_limit_ok(organization_id))
    )
  );
