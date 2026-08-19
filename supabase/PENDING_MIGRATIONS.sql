-- ============================================================
-- DEVOMETRICS -- PENDING MIGRATIONS: 0129
--
-- Everything through 0128 has been confirmed applied. 0129 adds a
-- single column (is_new_hire) to organization_invites, gating whether
-- the probation-review automation auto-starts on invite acceptance.
--
-- How to run: Supabase Dashboard -> SQL Editor -> paste this
-- entire file -> Run. If anything errors partway, copy the exact
-- error text back so it can be diagnosed rather than re-run blind.
-- ============================================================

-- ============================================================
-- 0129_invite_new_hire_flag.sql
-- ============================================================
-- 0129: Explicit is_new_hire flag on organization_invites
--
-- Both hire_to_onboarding (Knowledge Hub welcome content) and
-- hire_to_probation used to fire for EVERY invite-based join — someone
-- directly added on the Employees page got treated identically to someone
-- who actually came through the Hiring pipeline. Fine for the welcome
-- content (harmless either way), wrong for probation: an admin bulk-adding
-- existing staff to get them onto the platform would spin up a probation
-- review for every single one of them.
--
-- Per the CEO: keep welcome broad (unchanged), but probation should only
-- auto-start when there's a real signal this is a genuine new hire — either
-- (a) they came through the Hiring pipeline (candidate_id already implies
-- this), or (b) the admin explicitly marks them as one when inviting
-- directly. Default false everywhere so the safe/quiet behavior — no
-- probation review — is what happens unless someone opts in.

alter table public.organization_invites
  add column if not exists is_new_hire boolean not null default false;
