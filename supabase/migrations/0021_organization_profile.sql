-- Lets an org admin describe their company beyond just a name — website,
-- employee-count bucket, and industry. All optional and self-disclosed, same
-- pattern as the individual profile fields in 0005/0006. Nothing here is
-- read by RLS policies, so no security-definer function changes needed.
alter table public.organizations
  add column if not exists website text,
  add column if not exists employee_count text,
  add column if not exists industry text;
