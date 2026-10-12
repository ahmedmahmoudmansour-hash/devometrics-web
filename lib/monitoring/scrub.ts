// Scrubbing for error reports. This is an HR product: exception messages,
// breadcrumbs and URLs can contain employee emails, tokens or record content,
// and none of it should reach a third-party error tracker. Pure functions, no
// Sentry import, so they are unit-tested directly (lib/monitoring/scrub.test.ts).

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const AUTH_HEADER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const API_KEY = /\b(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{16,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,})\b/g;
// Query-string values often carry filters like email=eq.person@company.com or
// access tokens; drop the whole query from any URL we report.
const URL_QUERY = /(\bhttps?:\/\/[^\s"'<>?#]+)\?[^\s"'<>#]*/g;

// Stack frames nest deeply (exception > values > [n] > stacktrace > frames > [n]
// > pre_context > [n]); too shallow a limit left source-context lines unscrubbed.
const MAX_DEPTH = 16;

export function scrubString(value: string): string {
  return value
    .replace(JWT, "[token]")
    .replace(AUTH_HEADER, "$1 [token]")
    .replace(API_KEY, "[key]")
    .replace(URL_QUERY, "$1?[query]")
    .replace(EMAIL, "[email]");
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object" || depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubValue(v, depth + 1);
  }
  return out;
}

// Fields removed outright from an event's request block.
const DROPPED_REQUEST_FIELDS = ["cookies", "headers", "data", "query_string", "env"] as const;

type AnyEvent = Record<string, unknown> & {
  request?: Record<string, unknown>;
  user?: unknown;
  message?: unknown;
};

// Generic over any object so Sentry's own event types (interfaces without an
// index signature) are accepted unchanged.
export function scrubEvent<T extends object>(event: T): T {
  const next = { ...(event as AnyEvent) };

  // Never attach who the user is: an error report is about the app, not the person.
  delete next.user;

  if (next.request && typeof next.request === "object") {
    const request: Record<string, unknown> = { ...next.request };
    for (const field of DROPPED_REQUEST_FIELDS) delete request[field];
    if (typeof request.url === "string") request.url = scrubString(request.url);
    next.request = request;
  }

  for (const key of ["message", "logentry", "exception", "breadcrumbs", "extra", "contexts", "tags", "transaction"]) {
    if (key in next) next[key] = scrubValue(next[key]);
  }
  return next as T;
}

export function scrubBreadcrumb<T extends object>(breadcrumb: T): T {
  return scrubValue(breadcrumb) as T;
}
