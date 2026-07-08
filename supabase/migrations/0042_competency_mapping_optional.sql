-- Mapping a custom competency onto one of the 8 fixed dimensions is now
-- optional — some competencies (e.g. purely values-based ones) don't cleanly
-- map onto the scoring engine, and forcing a mapping produced noisy data.
-- Unmapped competencies just don't get a score bar in the chart.
alter table public.organization_competencies
  alter column mapped_dimension drop not null;
