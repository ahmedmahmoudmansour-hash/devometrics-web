# HR system rollout audit — 2026-10-08

Scope: every HR feature behind `/dashboard/company/*` plus the employee-facing side, tested against the **live** database with throwaway accounts (never real companies' data), not just read from code.

## Verdict

**Do not onboard a business until migration `0190` is applied.** It closes a company-to-company data breach found in this audit. With `0190` and `0191` applied and the checklist below addressed, the system is ready for a **controlled pilot with one or two businesses**.

## Fixed in this audit

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | **Critical** | Any logged-in user could read every company's invite code and join any company as a member with no invitation, then read its member list (emails, phones, managers). | Fix in **0190** (pending) |
| 2 | High | Not-logged-in callers could reach database functions (`record_score_event` accepted writes; user→company and user→name lookups worked). | Fix in **0190** (pending) |
| 3 | Medium | Any logged-in user could forge entries in any company's compensation audit log. | Fix in **0190** (pending) |
| 4 | Medium | Employees could write decision fields on their own leave request ("Pre-approved by HR") and reopen a rejected one; days weren't tied to dates. | Fix in **0191** (pending) |
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

1. ~~Attendance clock times are client-supplied (medium).~~ **Fixed in 0192** (pending): server clock in a per-company timezone, setting in Settings → Company timezone.
2. ~~Onboarding steps can be self-completed.~~ **Not an issue today:** no app code touches the configurable-onboarding tables (dormant schema). Revisit only if that feature is revived — restrict the writable columns then.
3. ~~Leave day counts are typed; no weekend/holiday calendar.~~ **Fixed in 0194** (pending): per-company weekend days + public holidays, days counted by the database. Still by design: no balance check — HR may approve beyond a balance; the form warns the employee.
4. **`xlsx` library has a high advisory and no fix** — only used to read spreadsheets in the admin's own browser; plan a replacement.
5. ~~AI-spend lookups readable by any logged-in user; deletion cron jobs failing open if their secret row is removed.~~ **Fixed in 0193** (pending). Still open (low): the public chatbot rate limiter is per-server-instance; the contact form has no spam protection; `org_seat_limit_ok` reveals whether a seat is free (needed by the join rule).

## Not tested end-to-end in this audit

Hiring pipeline through to hire, Knowledge Hub / SCORM, org chart, job architecture, competencies, high-potential/succession, analytics, performance-review cycles (verified in earlier audits and sessions), and export file contents. (Pages were loaded and checked for errors; features behind them were not all exercised.)

## Rollout readiness (not code)

- **Backups:** Supabase Free plan has no real backup/PITR. This was a deliberate deferral "until paying customers" — real company HR data is that trigger. Upgrade to Pro before onboarding.
- **Email:** confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in Vercel, the sender domain is verified (SPF/DKIM), and the plan's daily limit covers a company's invites/reminders. Confirm custom SMTP in Supabase Auth (the built-in sender is heavily rate-limited — a batch of new employees will hit it).
- **No error monitoring and no automated tests.** Add uptime + error alerts before a business depends on it.
- **No staging database.** Every migration is pasted straight into production; a second Supabase project for rehearsal is cheap insurance.
- **Billing:** manual invoicing is fine; remove the unbuilt Premium claims (Interview Simulator, salary benchmark) from any business-facing pricing.
- **Legal:** a data-processing agreement and privacy terms covering employee data, including that platform staff can see organization/member records. Export and deletion already exist.
- **After `0190`:** companies that joined by code must switch on Settings → "Join with company code". Email invites are unaffected.
