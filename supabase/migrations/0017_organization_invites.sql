-- Per-email invites: the middle ground between "share one open code" and
-- "admin creates the login directly." This app has no service-role key
-- (deliberately — see 0016's comment), so an admin can't create someone
-- else's login; the employee still signs up and sets their own password.
-- What this adds is admin-controlled *authorization*: only emails the
-- admin explicitly listed get auto-attached, no shared secret involved.
create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table public.organization_invites enable row level security;

create policy "Org admins can manage invites for their organization"
  on public.organization_invites for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Lets a brand-new signee find their own pending invite by email before
-- they're a member of anything (is_org_admin/is_org_member wouldn't match
-- yet) — matched against the authenticated user's own verified JWT email
-- only, never an arbitrary client-supplied string.
create policy "Users can see invites addressed to their own email"
  on public.organization_invites for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Lets the invited person mark their own invite accepted after joining —
-- scoped to only the row matching their own verified email, not admin-wide
-- update access.
create policy "Users can accept their own invite"
  on public.organization_invites for update
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

create index if not exists organization_invites_org_idx on public.organization_invites (organization_id);
create index if not exists organization_invites_email_idx on public.organization_invites (lower(email));
