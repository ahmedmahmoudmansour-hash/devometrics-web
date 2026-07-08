-- Lets an org admin capture department/country per employee at invite time,
-- for later HR reporting/export -- requested by a business-manager tester
-- who wanted to segment the workforce data beyond just name/title.
alter table public.organization_invites
  add column if not exists department text,
  add column if not exists country text;

alter table public.organization_members
  add column if not exists department text,
  add column if not exists country text;
