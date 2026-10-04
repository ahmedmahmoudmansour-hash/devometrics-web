-- READ-ONLY diagnostic — no writes, safe to run anytime. Run this in the
-- Supabase SQL Editor and paste the three result sets back so we can see
-- exactly which org(s)/records are producing the recurring reminder
-- emails, before deciding what (if anything) to delete.
--
-- Kept in the repo as a reusable check: it already identified the stale
-- orgs that CLEANUP_stale_test_orgs.sql removes. Re-run it after that
-- cleanup -- queries 2 and 3 should come back empty for the deleted orgs.

-- 1) Every organization, oldest first — helps tell "old test cycle" apart
--    from "current testing" by creation date / name.
select id, name, slug, created_at,
  (select count(*) from organization_members m where m.organization_id = o.id) as member_count
from organizations o
order by created_at asc;

-- 2) Hiring candidates stuck 14+ days in a non-terminal stage — this is
--    exactly what triggers "Your hiring pipeline needs a look".
select o.name as org_name, c.full_name as candidate_name, c.stage,
  c.created_at, now() - c.created_at as stuck_for
from hiring_candidates c
join organizations o on o.id = c.organization_id
where c.stage not in ('hired', 'rejected')
  and c.created_at < now() - interval '14 days'
order by c.created_at asc;

-- 3) Knowledge Hub assignments with no matching completion — this is
--    exactly what triggers "X hasn't completed required training".
select o.name as org_name, kc.title as content_title, p.full_name as employee_name,
  a.created_at as assigned_at
from knowledge_hub_assignments a
join knowledge_hub_content kc on kc.id = a.content_id
join organizations o on o.id = kc.organization_id
join profiles p on p.id = a.employee_user_id
left join knowledge_hub_completions comp
  on comp.content_id = a.content_id and comp.employee_user_id = a.employee_user_id and comp.passed = true
where comp.id is null
order by a.created_at asc;
