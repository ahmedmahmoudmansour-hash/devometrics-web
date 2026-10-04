-- Deletes 4 confirmed-stale test organizations and everything under them
-- (every child table's organization_id has ON DELETE CASCADE, so this
-- alone removes their members, hiring candidates, knowledge hub content/
-- assignments, compensation records, leave records, etc.).
--
-- Deliberately targets exact IDs, not names, to avoid any ambiguity:
--   Meridian Retail Group        22637c2b-0c65-435e-acda-a76ff271aa3b  (source of the recurring reminder emails)
--   RLS Migration Test Org       fdb5fc6a-3df1-4bdb-8f9b-0bf5cdb390b0  (named "delete me", 0 members)
--   Audit RLS Test Org           069bc398-7c81-421e-97db-0c023e6f5cf5
--   Claude Verify Test Co        48f585d9-28a6-495b-a9a3-7c121bb771dd
--
-- Deliberately does NOT touch: Home Center (contains another real
-- person's data), Mansour Corp (unconfirmed), or Claude Compensation
-- Test Co (the current active test org).
--
-- PROTECTED ACCOUNT: HEndtarekismail@gmail.com is an existing real member
-- and must be kept (confirmed by Ahmed). Step 2 below refuses to delete
-- anything if she is a member of any of the 4 orgs, so a mistake in the
-- ID list above cannot cost her her membership. Deleting an org never
-- touches auth.users -- accounts themselves are never deleted here.
--
-- Run ONE step at a time (select just that block, then Run) -- the SQL
-- Editor only shows the result of the last statement in a selection.

-- ============================================================
-- STEP 1 (read-only): what is about to be deleted, and who is in it.
-- Expect exactly 4 rows, and protected_member = false on every row.
-- ============================================================
select
  o.id, o.name, o.slug, o.created_at,
  (select count(*) from organization_members m where m.organization_id = o.id) as member_count,
  exists (
    select 1 from organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = o.id and lower(u.email) = 'hendtarekismail@gmail.com'
  ) as protected_member
from organizations o
where o.id in (
  '22637c2b-0c65-435e-acda-a76ff271aa3b',
  'fdb5fc6a-3df1-4bdb-8f9b-0bf5cdb390b0',
  '069bc398-7c81-421e-97db-0c023e6f5cf5',
  '48f585d9-28a6-495b-a9a3-7c121bb771dd'
);

-- ============================================================
-- STEP 2 (destructive): guarded delete. One DO block, so the guard and
-- the delete are atomic -- if the guard fires, nothing is deleted.
-- ============================================================
do $$
declare
  v_protected int;
  v_deleted int;
begin
  select count(*) into v_protected
  from organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id in (
      '22637c2b-0c65-435e-acda-a76ff271aa3b',
      'fdb5fc6a-3df1-4bdb-8f9b-0bf5cdb390b0',
      '069bc398-7c81-421e-97db-0c023e6f5cf5',
      '48f585d9-28a6-495b-a9a3-7c121bb771dd'
    )
    and lower(u.email) = 'hendtarekismail@gmail.com';

  if v_protected > 0 then
    raise exception 'Aborted: HEndtarekismail@gmail.com is a member of one of these orgs. Nothing was deleted.';
  end if;

  delete from organizations
  where id in (
    '22637c2b-0c65-435e-acda-a76ff271aa3b',
    'fdb5fc6a-3df1-4bdb-8f9b-0bf5cdb390b0',
    '069bc398-7c81-421e-97db-0c023e6f5cf5',
    '48f585d9-28a6-495b-a9a3-7c121bb771dd'
  );
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % organization(s).', v_deleted;
end $$;

-- ============================================================
-- STEP 3 (read-only): confirm the protected account is untouched.
-- Expect at least one row (her surviving membership), and the 4 deleted
-- org ids absent from the second result.
-- ============================================================
select u.email, o.name as org_name, m.role, m.employment_status
from auth.users u
join organization_members m on m.user_id = u.id
join organizations o on o.id = m.organization_id
where lower(u.email) = 'hendtarekismail@gmail.com';

-- select id, name from organizations order by created_at;  -- remaining orgs
