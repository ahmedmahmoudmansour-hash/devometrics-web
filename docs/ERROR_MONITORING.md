# Error monitoring and uptime

The app ships with error monitoring (Sentry) and a health endpoint. Both are
**inert until you switch them on**: with no DSN configured nothing is sent
anywhere.

## What it does

- Reports unhandled errors from pages, server components, route handlers and
  server actions, plus the errors the app handles quietly and logs with
  `console.error` (most server actions degrade gracefully instead of throwing,
  so without this they would never be seen).
- **Scrubs everything before it leaves the app** (`lib/monitoring/scrub.ts`,
  proven by `tests/unit/sentry-transport.test.ts`): email addresses, bearer
  tokens/JWTs/API keys, URL query strings, cookies, request headers and bodies,
  and the signed-in user's identity are removed. It sends no session replays and
  no performance traces.
- `GET /api/health` returns `200 {"ok":true,"database":"ok"}` when the app and
  the database answer, `503` otherwise. Use it as the target of an uptime check.

## Turning it on (about 10 minutes)

1. Create a Sentry project (platform: Next.js). Choose the **EU data region**
   if your customers' data-residency terms need it.
2. In Vercel → Project → Settings → Environment Variables, add (Production and
   Preview):
   - `NEXT_PUBLIC_SENTRY_DSN` — the project's DSN. Used by browser, server and edge.
3. Optional, for readable stack traces: also add `SENTRY_AUTH_TOKEN`,
   `SENTRY_ORG`, `SENTRY_PROJECT` (an auth token with `project:releases` and
   `org:read`). Without them everything still works; traces are just minified.
4. Redeploy, then sign in as a platform admin and send a test event:
   `POST /api/monitoring/test` (browser dev tools, or any REST client with your
   session). It should appear in Sentry within a minute.
5. In Sentry, create an alert: *notify me on a new issue* and *error rate above
   N per hour*, to your email/Slack.
6. Create an uptime check (UptimeRobot, Better Stack, or Vercel's) on
   `https://www.devometrics.com/api/health`, every 1–5 minutes, alerting on
   non-200.

## Before you turn it on: privacy policy

Sentry becomes a sub-processor of error data. Add it to the third-party list in
the privacy policy first (`messages/*.json`, section "Third parties"). That
section is already incomplete: besides Anthropic and Supabase the product also
sends data to OpenRouter (job-description and role AI features), Resend (email),
Speechmatics / Azure (voice), and Lemon Squeezy (billing, when enabled). Have the
list and your DPA reviewed before the December rollout.

## Day-to-day

- Source of truth for "is anything broken?": the Sentry issues list plus the
  uptime check. Vercel's own function logs remain available for deep dives.
- A burst of one new issue after a deploy usually means the release; the release
  tag is the git commit SHA.
- If an error report ever contains personal data, treat it as a bug in
  `lib/monitoring/scrub.ts`: add a failing case to `scrub.test.ts` first.
