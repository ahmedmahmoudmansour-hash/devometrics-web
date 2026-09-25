import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { resolveCallerLocale } from "@/lib/i18n/request";
import { runGroundedSearchStream } from "@/lib/ai/groundedSearchStream";

// 60s is plenty of headroom now. This route used to be a two-phase call
// with the web_search_20260209 tool, whose search runs through a code-
// execution sandbox — measured directly at 116-200s+ per call, which
// Vercel silently killed mid-stream ("stuck on Searching… forever"). The
// rewrite below is a single call (via lib/ai/groundedSearchStream, shared
// with /api/courses) with the BASIC web_search_20250305 tool (classic
// direct search, no code execution): measured at 11-15s end to end for the
// same job. If web_search_20250305 is ever retired, the fallback is
// web_search_20260209 with the two-phase narration-stripping workaround —
// preserved in git history before this commit.
export const maxDuration = 60;

const MAX_JOB_TITLE_LENGTH = 120;

// Trends don't meaningfully change hour to hour — a cache hit is
// near-instant vs. the live search below. Shared across ALL users, not
// per-account: job-market trends for "Product Manager" are the same
// regardless of who asked.
const CACHE_TTL_HOURS = 24 * 7;

function normalizeJobTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

const SEARCH_ERROR_MESSAGES: Record<Anthropic.WebSearchToolResultErrorCode, string> = {
  too_many_requests: "Trend search is rate-limited right now — please try again in a few minutes.",
  max_uses_exceeded: "Reached the search limit for this request — please try again.",
  query_too_long: "That job title is too long to search — try a shorter version.",
  request_too_large: "The request was too large to search — try a shorter job title.",
  invalid_tool_input: "Could not run that search — please try again.",
  unavailable: "Web search is temporarily unavailable — please try again shortly.",
};

// Grounds "key trends" in a real web search rather than the model's
// training knowledge alone — matches the Data Ethics stance already
// shipped elsewhere in the app (no fabricated specifics; only claims we
// can back with real evidence). Sources are asked for inline in the prose.
//
// Streamed progressively (the search itself takes ~5-9s before any text,
// then the summary appears sentence by sentence). Cache hits skip the
// search entirely and return the stored summary in one shot.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { jobTitle } = (await request.json()) as { jobTitle?: string };
  if (!jobTitle?.trim()) {
    return NextResponse.json({ error: "Job title is required" }, { status: 400 });
  }
  if (jobTitle.length > MAX_JOB_TITLE_LENGTH) {
    return NextResponse.json({ error: "Job title is too long" }, { status: 400 });
  }

  const locale = await resolveCallerLocale(supabase, user.id);
  // Locale-suffixed — the cache is shared across ALL users, so without this
  // an Arabic-UI user could be served a cached English summary generated
  // for someone else's locale. Old pre-locale keys become harmless orphans.
  const jobTitleKey = `${normalizeJobTitle(jobTitle)}::${locale}`;
  const encoder = new TextEncoder();

  // Cache check — a query error here (e.g. migration 0053 not run yet)
  // falls straight through to the live search path below.
  const { data: cached } = await supabase
    .from("key_trends_cache")
    .select("summary, generated_at")
    .eq("job_title_key", jobTitleKey)
    .maybeSingle<{ summary: string; generated_at: string }>();
  if (cached) {
    const ageHours = (Date.now() - new Date(cached.generated_at).getTime()) / 3_600_000;
    // Rows written before the two-phase→single-call rewrite may carry a
    // leading "Based on current sources, here are…" preamble the old
    // prompt didn't suppress — the TTL alone will age them out within a
    // week, so no SQL cleanup needed; just don't serve anything older
    // than the rewrite.
    const REWRITE_DEPLOYED_AT = new Date("2026-09-10T00:00:00Z").getTime();
    const isPreRewrite = new Date(cached.generated_at).getTime() < REWRITE_DEPLOYED_AT;
    if (ageHours < CACHE_TTL_HOURS && !isPreRewrite) {
      return new Response(encoder.encode(cached.summary), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Trends-Cached": "true" },
      });
    }
  }

  const userPrompt = `Search the web and give 3-5 current trends for someone working as "${jobTitle}" right now — in-demand skills, tools or technologies gaining adoption, hiring/market shifts, or emerging responsibilities in that field. Only include things you can back with a real source you found. Output ONLY a bulleted list: one bullet per trend, 1-2 sentences each, each ending with the source in parentheses, e.g. "(source: example.com)". No preamble, no heading, no closing note. Do not fabricate specifics or present a guess as fact.${locale === "ar" ? " Write the entire summary in Modern Standard Arabic (Fusha) — the trend content and prose, not just a translated label — regardless of what language your search results come back in." : ""}`;

  const readable = runGroundedSearchStream({
    userPrompt,
    errorMessages: SEARCH_ERROR_MESSAGES,
    emptyResultFallback: "Could not generate trends right now — please try again.",
    exceptionFallback: "Could not fetch trends right now — please try again.",
    // Best-effort cache write — a failure here shouldn't affect the
    // response the user is already looking at (runGroundedSearchStream
    // already catches and logs any error this throws).
    onSuccess: async (finalText) => {
      await supabase
        .from("key_trends_cache")
        .upsert({ job_title_key: jobTitleKey, job_title: jobTitle.trim(), summary: finalText, generated_at: new Date().toISOString() });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Trends-Cached": "false",
    },
  });
}
