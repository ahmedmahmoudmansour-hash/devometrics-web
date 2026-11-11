-- ============================================================================
-- DEVOMETRICS: APPLY PACK FOR MIGRATION 0209 (a company admin may give themselves a knowledge check)
-- Lets an admin who is also an employee (for example the owner of a small company) be given a knowledge check. Changes one
-- rule on one table; no row is touched.
--
-- Apply after 0207. Paste this whole file into a NEW, EMPTY query tab in the Supabase SQL Editor, click once in the editor so
-- nothing is highlighted, and press Run. The last result is a check table: every row should say PASS.
-- To undo: run supabase/ROLLBACK_0209.sql.
-- ============================================================================

-- 0209: a company admin may give themselves a knowledge check.
--
-- 0207 forbade anyone assigning a knowledge check to themselves. That also shut out an admin who is also an employee (for
-- example the owner of a small company, who is the admin and still has a role of their own): nobody could assess them unless a
-- second admin existed. Role assessments already allow this (an admin may assign to anyone in the company).
--
-- Only the "no self-assignment" line changes: a person still cannot assign themselves one UNLESS they are an admin of the
-- company. Everything else in the rule is kept exactly: assigned_by must be the caller, no answers yet, not submitted, admin or
-- the person's manager, and the person must belong to the same company. A manager or ordinary employee still cannot assign
-- themselves one. Safe to run more than once. To undo: supabase/ROLLBACK_0209.sql.

drop policy if exists "Assign knowledge checks" on public.knowledge_checks;
create policy "Assign knowledge checks"
  on public.knowledge_checks for insert
  with check (
    assigned_by = auth.uid()
    and (employee_user_id <> auth.uid() or public.is_org_admin(organization_id))
    and answers is null
    and submitted_at is null
    and (public.is_org_admin(organization_id) or public.is_manager_of_user(employee_user_id))
    -- the person must belong to the same company the check is for
    and public.knowledge_check_member_ok(employee_user_id, organization_id)
  );

-- ---------------------------------------------------------------------------
-- Checks (the last result shown). Every row should say PASS.
select check_name, case when ok then 'PASS' else 'FAIL' end as result, detail
from (
  select 'the knowledge_checks table exists (0207 applied)' as check_name,
         to_regclass('public.knowledge_checks') is not null as ok,
         'public.knowledge_checks' as detail
  union all
  select 'the assign rule exists exactly once',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'knowledge_checks' and policyname = 'Assign knowledge checks') = 1,
         'Assign knowledge checks'
  union all
  select 'the assign rule lets an admin assign to themselves',
         coalesce((select position('is_org_admin' in with_check) > 0 and position('<>' in with_check) > 0
                   from pg_policies where schemaname = 'public' and tablename = 'knowledge_checks' and policyname = 'Assign knowledge checks' limit 1), false),
         'self-assignment only when is_org_admin'
  union all
  select 'the four policies still exist',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'knowledge_checks') = 4,
         'read, assign, answer, withdraw'
) c
order by ok, check_name;
