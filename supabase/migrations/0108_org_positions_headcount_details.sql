-- 0108: Headcount + details on org_positions — lets an admin annotate a
-- structural/vacant box in the Org Chart (e.g. a "Public Works" department
-- box with no single person attached) with a manually-entered headcount
-- number and a free-text description, per Ahmed's ask to "create a box
-- somewhere with title, headcount, and details." Headcount is
-- admin-entered rather than auto-counted from the chart — the org chart
-- isn't always fully populated, so a manual number is more useful than an
-- auto-count that could read as artificially low. Both columns are
-- nullable and apply to either position kind (vacant_role or structural) —
-- no reason to restrict either field to just one kind.

alter table public.org_positions
  add column if not exists headcount integer,
  add column if not exists details text;
