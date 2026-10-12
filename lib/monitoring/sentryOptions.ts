import { scrubBreadcrumb, scrubEvent } from "./scrub";

// Shared by the server, edge and browser Sentry configs. Monitoring is inert
// unless a DSN is configured, so nothing is sent from a local or preview build
// that lacks one.
//
// Deliberately minimal: no performance tracing, no session replay, no default
// PII. Error reports go through scrubEvent/scrubBreadcrumb first.
//
// NEXT_PUBLIC_* values are normally inlined into the bundle at build time. The
// server also looks the name up dynamically, which reads the real runtime
// environment, so server-side reporting works even when a rebuild reused a
// cached bundle compiled before the variable existed.
const runtimeEnv = process.env as Record<string, string | undefined>;
const PUBLIC_DSN_NAME = "NEXT_PUBLIC_SENTRY_DSN";
const dsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN || runtimeEnv[PUBLIC_DSN_NAME] || runtimeEnv["SENTRY_DSN"] || undefined;

export function sharedSentryOptions() {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Control-flow "errors" Next.js throws on purpose, and browser noise that
    // is not an application fault.
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND", /ResizeObserver loop/i, /Loading chunk \d+ failed/i],
    beforeSend: <T extends object>(event: T) => scrubEvent(event),
    beforeBreadcrumb: <T extends object>(breadcrumb: T) => scrubBreadcrumb(breadcrumb),
  };
}
