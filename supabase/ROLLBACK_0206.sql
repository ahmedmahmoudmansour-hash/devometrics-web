-- ROLLBACK for migration 0206 (role-specific assessment questions). Emergency use only.
-- Removes the role column and the per-role uniqueness. It does NOT restore the old one-set-per-level rule, because after
-- 0206 there can be several sets for the same level (one per role) and the old rule would refuse them. The application
-- still works without it: with the column gone it reads and writes questions the way it did before 0206.
alter table public.competency_assessment_items drop constraint if exists competency_assessment_items_role_context_length;
drop index if exists public.competency_assessment_items_per_role_uidx;
alter table public.competency_assessment_items drop column if exists role_context;
