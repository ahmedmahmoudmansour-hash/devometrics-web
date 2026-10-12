# Tests

Two suites, deliberately separate.

## Unit tests — `npm test`

Fast (about a second), offline, no accounts needed. Runs in CI on every push.

| Where | What it protects |
|---|---|
| `lib/**/*.test.ts` | Pure logic next to the code it tests: org chart tree and loops, leave working-day counting, timezones, SCORM manifest and file types, chatbot history sanitising, plan limits, the error-report scrubber |
| `tests/unit/i18n.test.ts` | English and Arabic stay in step: same keys, same placeholders |
| `tests/unit/migrations.test.ts` | Migration files are numbered without gaps; new policies are re-runnable; `SECURITY DEFINER` functions set a `search_path` |
| `tests/unit/secrets.test.ts` | No API keys, private keys or JWTs committed |
| `tests/unit/sentry-transport.test.ts` | Runs the real Sentry SDK against a local server and checks that what would leave the app contains no emails, tokens, user identity or request data |

## Live suite — `npm run test:live`

Exercises the **real database and storage as real users** (the same access a
customer's browser has — no service key). It proves tenant isolation, access
rules and the main flows (hiring through to hire, Knowledge Hub/SCORM, org
chart, public chatbot and contact-form limits).

Run it by hand after applying a migration and before a release. It is not in CI.

There is only one Supabase project, so it runs against production data, using
throwaway rows labelled `TEST` that each test removes again. It needs two
accounts that belong to a test company, supplied through the environment (they
are never stored in the repository):

```bash
TEST_ADMIN_EMAIL=...   TEST_ADMIN_PASSWORD=...    # an admin of a test company
TEST_MEMBER_EMAIL=...  TEST_MEMBER_PASSWORD=...   # an ordinary member of it
npm run test:live
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are read from
`.env.local`. If the `TEST_*` variables are not set the suite skips itself.

## Adding a test

- Pure function or component logic → a `*.test.ts` file beside it.
- A new migration that changes access rules → add the isolation check to
  `tests/live/` so it is re-proved on every release.
- Fixing a bug → add the test that would have caught it (the SCORM `.xsd` and
  org-chart-loop tests came from real bugs).
