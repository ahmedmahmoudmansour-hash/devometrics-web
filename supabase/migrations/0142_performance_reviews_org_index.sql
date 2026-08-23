-- 0142: Index performance_reviews on organization_id
--
-- performance_reviews already has indexes on cycle_id and employee_user_id
-- (0076), which cover almost every lookup in the app — but get_escalated_
-- reviews (0137) scans this table filtered ONLY by organization_id (every
-- currently-escalated review across the whole org, for the Escalated
-- Reviews admin widget), with no other indexed column to narrow the scan.
-- Cheap and purely additive to add now, before review-row counts grow
-- enough for that to actually show up as a slow query.

create index if not exists performance_reviews_organization_idx
  on public.performance_reviews (organization_id);
