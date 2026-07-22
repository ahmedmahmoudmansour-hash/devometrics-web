---
name: devometrics-migrations
description: Use this skill whenever writing, editing, or reviewing a Supabase SQL migration in devometrics-web — including adding a table/column, writing or changing an RLS policy, adding a SECURITY DEFINER helper function, or updating supabase/PENDING_MIGRATIONS.sql. Also use it before telling the user a migration is "ready to run," before claiming a DB-backed feature works, and whenever touching organizations/organization_members/organization_invites or any RLS policy in this repo — this is the highest-blast-radius, most error-prone part of this codebase and deserves the extra discipline every time, not just when it feels risky.
---

# Devometrics migration discipline

This project has **no Supabase service-role key** — a deliberate choice, not a
gap. Every schema change is raw SQL that gets handed to the user (Ahmed) to
paste into the Supabase SQL Editor himself. That constraint shapes everything
below: Claude never applies a migration directly, and the user is often
running these against the one and only Supabase project this app talks to —
there is no separate "safe" staging database. Treat every migration as if it
will be pasted into production, because it likely will be.

## Before writing a new migration

1. **Find the next number.** Migrations live in `supabase/migrations/NNNN_description.sql`, strictly sequential. Check the highest existing number — don't guess or reuse one.
2. **Check whether existing migrations already ran.** Don't assume yesterday's migration is live just because it's committed. If a feature depends on it, verify (see "Verifying a migration actually ran" below) before building further on top of it — building three more migrations on an unconfirmed foundation compounds the risk instead of catching it early.

## Writing the SQL itself

- **Every statement must be idempotent.** `create table if not exists`, `create or replace function`, `drop policy if exists ... ; create policy ...`, `alter table ... add column if not exists`. The user may run `PENDING_MIGRATIONS.sql` more than once, or after part of a batch already executed — a migration that fails on a second run isn't idempotent, it's broken.
- **Never guess a constraint name.** If you need to rename or replace a `check` constraint, look it up first via `information_schema.table_constraints` / `constraint_column_usage` inside a `do $$ ... end $$` block, and only add the new constraint if it doesn't already exist under that name. Postgres auto-generates constraint names in ways that drift across migration history — a hardcoded guess that happens to work today can silently fail (or silently no-op) after the next unrelated schema change.
- **Run a full collision sweep before finalizing.** Grep every new policy name, function name, and constraint name against the *entire* migration history, not just recent files:
  ```
  grep -l "<new policy/function/constraint name>" supabase/migrations/*.sql | grep -v <this migration's number>
  ```
  A repeated `create policy "X"` name without a preceding `drop policy if exists` on the same table will error on a second apply. If you find a name already used for a *different* purpose, rename yours — don't assume "it'll just get replaced."
- **Order matters within a batch.** If migration B alters a table migration A creates, or replaces a function migration A defines, A must come first in `PENDING_MIGRATIONS.sql`, and the header comment should say so explicitly — the user is pasting one block, not applying files one at a time in a controlled order.

## RLS is the real security boundary — not app-layer checks

Every access-control decision in this app must hold even if someone bypasses
the Next.js server actions entirely and hits Supabase directly with a valid
user JWT. App-layer checks (e.g. `inviteEmployee`'s seat-limit pre-check) are
allowed to exist, but only as a *friendlier early error* — they must never be
the only place a rule is enforced. Consistently in this codebase:

- Cross-user or cross-org visibility goes through a `SECURITY DEFINER` helper function (`is_admin()`, `is_org_admin(org_id)`, `is_org_member(org_id)`, `org_seat_limit_ok(org_id)`, `is_manager_of_user(user_id)`) rather than an inline subquery repeated in every policy — this also sidesteps RLS self-recursion when a policy on table X needs to check table X.
- A new capability that "shouldn't be possible for role Y" needs to be blocked by the `with check` clause on the relevant `insert`/`update` policy, not just by hiding the button in the UI.
- When extending an existing policy (e.g. adding a new way to satisfy an `insert` policy), add an `or (...)` branch alongside the existing branches rather than replacing the whole policy's intent — re-read what the existing branches protect against before touching them, since a rewritten policy that "looks equivalent" can quietly drop a check.

## Updating supabase/PENDING_MIGRATIONS.sql

This file is the single paste-and-run block the user actually executes. After
adding a new migration:
1. Append its full SQL to the end of the file, with a section header comment (`-- NNNN: short description`).
2. Update the file's top header comment to list the new migration number and summarize what it adds, and update the ordering note if the new migration depends on an earlier one in the batch.
3. Don't remove earlier migrations from this file just because they're old — the user may not have run the whole file yet. Only trim it once the user confirms everything in it has actually been applied.

## Verifying a migration actually ran

Don't take "I ran it" (or silence) as confirmation — verify behaviorally,
the same way you'd verify any other code change:

- The cheapest signal: try the feature that depends on the new schema and read the *specific* error. This codebase's server actions are written to fail with a message like `"...the database may need migration NNNN run first"` specifically so this check is easy — a matching error is conclusive proof the migration hasn't run.
- A feature that depends on a new table/column but is written to *gracefully degrade* on a missing-schema error (e.g. `getDailyInsight` catching the query error and returning `null`) will fail **silently** — absence of the feature's output (no error, but also no expected content) is itself a signal worth investigating, not proof everything is fine.
- If you only have one Supabase project to test against (check `.env.local` — if there's a single `NEXT_PUBLIC_SUPABASE_URL` and no staging variant, there is no separate safe environment), remember that whatever you do to verify — including creating a throwaway test account — happens against the same database the user's real data lives in. Prefer read-only checks first; if you must write test data (a signup, a test org), say so and keep it easy to identify/clean up later (e.g. an obviously-named test email).

## Testing the invite-only signup gate

Signup requires an invite code gated by `SIGNUP_INVITE_CODE` in `.env.local` —
read it directly from that file when you need to create a test account rather
than asking the user for it; it's a local dev config value, not a secret you
need to protect from yourself.
