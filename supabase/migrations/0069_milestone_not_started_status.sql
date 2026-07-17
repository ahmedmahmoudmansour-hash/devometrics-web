-- Adds a genuine "Not started" status, distinct from "In progress" — every
-- newly generated milestone was defaulting to 'in_progress' even though
-- nothing had actually begun on it yet, which is exactly backwards for a
-- fresh plan (caught via live use: a brand-new 7-milestone plan showed as
-- "7 In progress" / "0 Not started"). Existing rows are left alone (there's
-- no reliable signal to reclassify them from — someone may genuinely have
-- started work already), but every milestone created from here forward
-- starts honestly at 'not_started' via the new column default, and the
-- richer status control (MilestoneRow) now offers all four states.

-- Drops whatever the status check constraint is ACTUALLY named, looked up
-- from information_schema rather than assumed — Postgres's default
-- auto-naming for an unnamed column CHECK (<table>_<column>_check) is very
-- likely "milestones_status_check", but "very likely" isn't good enough
-- for a migration someone is about to run once against a real database.
-- information_schema.constraint_column_usage (not raw pg_constraint.conkey,
-- whose population for CHECK constraints has version-specific quirks) is
-- the ANSI-standard, reliable way to find which columns a constraint
-- touches — this can't fail on a wrong guess.
do $$
declare
  existing_constraint text;
begin
  select tc.constraint_name into existing_constraint
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
    and ccu.constraint_schema = tc.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'milestones'
    and tc.constraint_type = 'CHECK'
    and ccu.column_name = 'status'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.milestones drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.milestones
  alter column status set default 'not_started';

alter table public.milestones
  add constraint milestones_status_check
  check (status in ('not_started', 'in_progress', 'completed', 'deferred'));
