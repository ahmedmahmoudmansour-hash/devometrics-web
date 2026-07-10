-- Line manager's email alongside their name on employee HR records —
-- needed for future manager workflows (notifications, approvals) and for
-- HR exports that feed other systems keyed on email, not display name.
alter table public.organization_members
  add column if not exists manager_email text;

alter table public.organization_invites
  add column if not exists manager_email text;
