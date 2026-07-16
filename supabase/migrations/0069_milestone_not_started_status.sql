-- Adds a genuine "Not started" status, distinct from "In progress" — every
-- newly generated milestone was defaulting to 'in_progress' even though
-- nothing had actually begun on it yet, which is exactly backwards for a
-- fresh plan (caught via live use: a brand-new 7-milestone plan showed as
-- "7 In progress" / "0 Not started"). Existing rows are left alone (there's
-- no reliable signal to reclassify them from — someone may genuinely have
-- started work already), but every milestone created from here forward
-- starts honestly at 'not_started' via the new column default, and the
-- richer status control (MilestoneRow) now offers all four states.

alter table public.milestones
  drop constraint if exists milestones_status_check;

alter table public.milestones
  alter column status set default 'not_started';

alter table public.milestones
  add constraint milestones_status_check
  check (status in ('not_started', 'in_progress', 'completed', 'deferred'));
