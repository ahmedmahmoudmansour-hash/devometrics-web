-- Real plan horizons: which timescale a plan targets, plus per-milestone
-- pacing detail (weekly time commitment, a qualitative budget note — not a
-- fabricated dollar figure, since real course pricing can't be verified —
-- and a concrete success indicator instead of just a checkbox).
alter table public.development_plans
  add column if not exists horizon text;

alter table public.milestones
  add column if not exists weekly_hours integer,
  add column if not exists budget_note text,
  add column if not exists success_indicator text;
