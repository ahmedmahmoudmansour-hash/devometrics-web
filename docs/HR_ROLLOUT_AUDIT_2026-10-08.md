# HR system rollout audit — 2026-10-08

Scope: every HR feature behind `/dashboard/company/*` plus the employee-facing side, tested against the **live** database with throwaway accounts (never real companies' data), not just read from code.

## Verdict

**Update 2026-10-09: migrations 0190–0194 are applied and every fix was re-tested live (30 checks pass, 26-page regression crawl clean).** The company-to-company breach found in this audit is closed. The system is ready for a **controlled pilot with one or two businesses** once the non-code checklist below is addressed.

## Remaining work — consolidated (2026-10-10)

Everything still open from this audit and the sessions around it, in one list. Detail for each is in the sections below.

**Code (small)**
1. `xlsx` library (high advisory, no fix): replace with a maintained spreadsheet reader. Only parses files in an admin's own browser, so exposure is low.

**Second pass (2026-10-10/11): the previously untested features were exercised live** — see "Second pass" below. Findings are fixed in code (pushed) and in migrations 0197–0199, **applied and verified live 2026-10-11** (32 database checks + 9 through the running app).

**Needs a decision from Ahmed**
2. Mansour Corp (and Home Center): keep, or delete with a guarded script. Neither was touched.
3. Pilot-feedback section: on hold.
4. Arabic brand pronunciation in the product video: verified by speech-to-text only; needs a listen by ear.

**Not code — before a business depends on it**
5. Upgrade Supabase to Pro (real backups) before real client data.
6. Email: confirm Resend key/sender/domain and custom SMTP in Supabase Auth.
7. Error monitoring is built and tested (Sentry, scrubbed, inert until a DSN is set) and a `/api/health` uptime endpoint exists: turn it on with `docs/ERROR_MONITORING.md` (about 10 minutes). Still open: a staging database for rehearsing migrations.
8. Remove unbuilt Premium claims from business-facing pricing; DPA/privacy terms for employee data.
9. Companies that joined by code before 0190 must switch on Settings → "Join with company code" (email invites unaffected).

**Closed since the report was first written:** 0197–0199 (second pass, applied and verified 2026-10-11); 0190–0194 (applied, verified), 0195 contact form (applied, verified, test rows deleted); 0196 chatbot limit (applied, verified: shared limit survives a process restart; history entries bounded).

## Second pass — features not covered by the first audit (2026-10-10/11)

Each was exercised live with real user tokens (a company admin, an ordinary member, an outsider), not just read.

| Area | Result |
|---|---|
| **Hiring, posting → candidate → CV score → notes → offer → hire → joining** | 38 live checks passed (tenant isolation on all 7 tables, invite-based join, own-CV-score-only visibility, storage). **3 defects fixed:** (1) the board's stage dropdown offered "Hired", which marked a candidate hired with **no invite** and hid the hire form, a dead end — option removed, server refuses Hired without an invite, and already-stranded candidates get the hire form back; (2) a person invited by two companies could join **neither** (the join lookup errored on two pending invites) — now takes the oldest; (3) the daily CV-scoring limit counted stored scores so re-scoring one candidate was never limited — now counts actual calls. **0197** (applied): hiring rows must belong to the same company as the posting/candidate they point at (a cross-company link was accepted; not reachable without another company's UUID, no data exposed). |
| **Knowledge Hub / SCORM** | Zip safety is solid (traversal, absolute paths, symlinks, zip bombs all rejected). Completion writes are RPC-only and ownership-checked. **Defects:** (1) **real SCORM packages failed to import** — the bucket rejected `.xsd/.txt/.webp/.ttf/.ico` files that nearly every SCORM 1.2 package contains; (2) **any member could download training files not assigned to them** straight from Storage; (3) SCORM completion data was uncapped and unthrottled. Fixed: code (MIME map) + **0198** (applied). **Architectural, not fixed:** package JavaScript is served same-origin and the iframe is `allow-scripts allow-same-origin`, so an uploaded package runs with the viewer's session — treat packages from third-party vendors as trusted code, or move package serving to a separate origin (a redesign). |
| **Org chart** | App-level cycle and membership checks are sound. **Defects:** planning data (vacant/future/frozen positions, saved chart drafts, annotations) was readable by every member — now admin-only (**0199**, applied); a reporting loop made both people vanish from the chart (fixed in code) and the database accepted loops (**0199** trigger, applied). |
| **Competencies** | RLS correct. The AI mapping suggestion was callable by any signed-in account with unbounded text — now admin-only and length-capped. |
| **Job architecture, succession** | Re-run after all recent migrations: pass. Nomination requires company membership in RLS. |
| **Analytics, high-potential** | Admin-gated; derived from already-scoped data; no separate write paths. |
| **Exports** | All admin-gated; cells are written as typed strings (no formula execution); the survey export carries no respondent linkage. |
| **Regression check on 0190** | None of the four functions revoked from signed-in users is called by the app. |

## Fixed in this audit

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **Critical** | Any logged-in user could read every company's invite code and join any company as a member with no invitation, then read its member list (emails, phones, managers). | Fixed — **0190** applied, verified live |
| 2 | High | Not-logged-in callers could reach database functions (`record_score_event` accepted writes; user→company and user→name lookups worked). | Fixed — **0190** applied, verified live |
| 3 | Medium | Any logged-in user could forge entries in any company's compensation audit log. | Fixed — **0190** applied, verified live |
| 4 | Medium | Employees could write decision fields on their own leave request ("Pre-approved by HR") and reopen a rejected one; days weren't tied to dates. | Fixed — **0191** applied, verified live |
| 5 | Critical (dependency) | Next.js middleware bypass advisory + 10 other vulnerable packages. | **Fixed, pushed** (11 → 5 findings, 0 critical) |
| 6 | Critical/High/Medium | Compensation: cross-org salary injection, audit log never wrote, self-approval lockout. | **Fixed and verified live** earlier (0186) |

## Verified clean (live)

- **Cross-company reads:** all 122 tables read as anonymous, employee and admin — no other company's rows returned (the one exception, the `organizations` table itself, is finding 1).
- **Cross-company writes:** an insert tagged with another company was rejected by all 66 organization-scoped tables.
- **API routes:** every export/AI route is gated; no secrets committed; only the two intended public variables ship to browsers.
- **Employee file privacy:** only the employee and company admins can read; HR-only fields enforced in the database.
- **Survey anonymity:** admins cannot read individual answers; results withheld below 3 responses; employees cannot answer as someone else.
- **Exit interviews, compensation, org settings:** admin-only by policy.
- **Translations:** English and Arabic have identical key sets (4,431 each).
- **Screens:** all 50 dashboard pages crawled as admin and as employee, in English and Arabic (200 page loads) — no server errors, no failed requests, no missing translations; employees are redirected away from every admin page. One cosmetic console warning on the org chart (a drag-and-drop accessibility id mismatch) — no functional effect.
- **Cron secrets:** wrong/missing secret returns nothing.

## Open — needs a decision (not fixed)

1. ~~Attendance clock times are client-supplied (medium).~~ **Fixed in 0192** (applied, verified live): server clock in a per-company timezone, setting in Settings → Company timezone.
2. ~~Onboarding steps can be self-completed.~~ **Not an issue today:** no app code touches the configurable-onboarding tables (dormant schema). Revisit only if that feature is revived — restrict the writable columns then.
3. ~~Leave day counts are typed; no weekend/holiday calendar.~~ **Fixed in 0194** (applied, verified live): per-company weekend days + public holidays, days counted by the database. Still by design: no balance check — HR may approve beyond a balance; the form warns the employee.
4. **`xlsx` library has a high advisory and no fix** — only used to read spreadsheets in the admin's own browser; plan a replacement.
5. ~~AI-spend lookups readable by any logged-in user; deletion cron jobs failing open if their secret row is removed.~~ **Fixed in 0193** (applied). **Contact form fixed in 0195** (applied, verified live: direct inserts blocked; database-enforced validation and 3/email/hour, 100/hour limits). **Chatbot limit fixed in 0196** (database-backed, 8/min + 40/hour per visitor, 300/hour overall; history entries validated and capped). Still open (low): `org_seat_limit_ok` reveals whether a seat is free (needed by the join rule).

## Still not exercised

Performance-review cycles end to end (verified in earlier audits and sessions, not re-run here), the AI-generated outputs themselves (CV scoring, interview assessment, ranking quality), real-browser playback of a real third-party SCORM package, and live email delivery.

## Rollout readiness (not code)

- **Backups:** Supabase Free plan has no real backup/PITR. This was a deliberate deferral "until paying customers" — real company HR data is that trigger. Upgrade to Pro before onboarding.
- **Email:** confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in Vercel, the sender domain is verified (SPF/DKIM), and the plan's daily limit covers a company's invites/reminders. Confirm custom SMTP in Supabase Auth (the built-in sender is heavily rate-limited — a batch of new employees will hit it).
- **Automated tests and error monitoring: now in place (2026-10-12).** 63 offline unit tests run in CI on every push (`npm test`), and a 23-test live suite re-proves tenant isolation and the main flows against the real database on demand (`npm run test:live`; see `tests/README.md`). Error monitoring (Sentry) and `/api/health` are built; they need the DSN and an uptime check switched on (`docs/ERROR_MONITORING.md`).
- **No staging database.** Every migration is pasted straight into production; a second Supabase project for rehearsal is cheap insurance.
- **Billing:** manual invoicing is fine; remove the unbuilt Premium claims (Interview Simulator, salary benchmark) from any business-facing pricing.
- **Legal:** a data-processing agreement and privacy terms covering employee data, including that platform staff can see organization/member records. Export and deletion already exist.
- **After `0190`:** companies that joined by code must switch on Settings → "Join with company code". Email invites are unaffected.
