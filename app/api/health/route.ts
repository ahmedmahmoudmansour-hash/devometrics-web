import { NextResponse } from "next/server";

// Uptime probe target (UptimeRobot, Better Stack, Vercel checks...). Public and
// unauthenticated by design, so it returns nothing sensitive: just whether the
// app is serving and whether the database/auth service answers.
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "unreachable" = "unreachable";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url) {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) database = "ok";
    }
  } catch {
    // leave "unreachable"
  }

  // Whether error monitoring has a DSN at runtime (a yes/no only, never the
  // value). Looked up by variable name so it reflects the real environment,
  // not what a build inlined.
  const env = process.env as Record<string, string | undefined>;
  const dsnConfigured = Boolean(env["NEXT_PUBLIC_SENTRY_DSN"] || env["SENTRY_DSN"]);

  const ok = database === "ok";
  return NextResponse.json(
    { ok, database, monitoring: dsnConfigured ? "configured" : "not configured", commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
