-- Job title alongside each org member — set by the admin at invite time
-- (or by the admin for themselves at company creation), copied onto the
-- membership row once the invite is consumed. Optional and self/admin
-- disclosed, same posture as every other profile-style field in this app.
alter table public.organization_invites
  add column if not exists title text;

alter table public.organization_members
  add column if not exists title text;
