-- Cleanup for test data left behind by the 2026-09-28 Compensation
-- Management security audit. Not a schema migration -- just data.
--
-- These four tables (compensation_records/proposals/approvals/changes)
-- have ZERO client-facing RLS policies by design (see 0154's header), so
-- I could not delete this test data myself through the app's normal
-- RLS-respecting access -- only a direct postgres-role connection (this
-- SQL Editor) can. Everything below is scoped to the throwaway
-- "Claude Compensation Test Co" org (id 6a52c135-20ec-4ff3-b6f5-
-- 5981acbb5fad) and matched by the exact test amounts/reason strings used
-- during the audit -- nothing here touches any other organization's data,
-- and it deliberately leaves that org's pre-existing baseline test data
-- (the manager relationship, the one Compensation Admin grant, and the
-- older "Audit test proposal" / $72,000 record from an earlier session)
-- untouched, since that org gets reused for future testing.
--
-- Updated 2026-09-28 after live-verifying migration 0186's three fixes --
-- that verification pass left one more approved test record/change plus
-- one never-approved (harmless but noisy) proposal behind, added below.
--
-- Safe to run once; re-running is a no-op (nothing left to match).

-- compensation_approvals cascades automatically when its proposal is
-- deleted (proposal_id ... on delete cascade, migration 0155) -- no
-- separate delete needed for those rows.

delete from public.compensation_changes
where organization_id = '6a52c135-20ec-4ff3-b6f5-5981acbb5fad'
  and new_amount in (250000, 300000, 330000);

delete from public.compensation_records
where organization_id = '6a52c135-20ec-4ff3-b6f5-5981acbb5fad'
  and amount in (250000, 300000, 330000);

delete from public.compensation_proposals
where organization_id = '6a52c135-20ec-4ff3-b6f5-5981acbb5fad'
  and reason in (
    'SELF-APPROVAL TEST',
    'SELF-APPROVAL RETEST (2 comp admins)',
    'STALE-GRANT LOCKOUT TEST',
    'STALE-GRANT LOCKOUT TEST 2 (terminated path)',
    'POST-FIX LOCKOUT RETEST',
    'REGRESSION: should still be blocked'
  );

-- The one audit-log row I inserted directly (as VOLATILE, bypassing the
-- read-only-transaction bug) to isolate finding #2 -- not a real read
-- event, just diagnostic noise.
delete from public.compensation_audit_log
where summary = 'DIRECT AUDIT ISOLATION TEST';

-- Everything else this audit generated in compensation_audit_log (the
-- propose/approve/edit rows the write-side trigger correctly logged for
-- the test proposals above) is left in place -- it's an accurate record of
-- what actually happened and this org's audit log is throwaway test data
-- anyway. Delete it too if you'd rather have a clean slate:
--   delete from public.compensation_audit_log
--   where organization_id = '6a52c135-20ec-4ff3-b6f5-5981acbb5fad'
--     and created_at > '2026-09-28 13:00:00+00';
