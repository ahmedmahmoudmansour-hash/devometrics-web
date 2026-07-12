import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_JOB_TITLE_LENGTH = 120;

// Trends don't meaningfully change hour to hour — a cache hit is
// near-instant vs. the multi-search agent loop below, which is what
// actually made this feel slow (not the LLM call itself). Shared across ALL
// users, not per-account: job-market trends for "Product Manager" are the
// same regardless of who asked.
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

// Grounds "key trends" in a real web search rather than the model's training
// knowledge alone — matches the Data Ethics stance already shipped elsewhere
// in the app (no fabricated specifics; only claims we can back with real
// evidence). Sources are asked for inline in the prose rather than parsed
// out of the response's citation metadata, so this doesn't depend on the
// exact shape of that (less-documented) field.
//
// Streamed (same architecture as Coach/Roleplay): a fresh, uncached search
// still has to run 2-4 real web searches before Claude can write anything,
// so there's an unavoidable stretch of silence no matter what — but once
// Claude starts writing the summary, streaming means the user sees it
// appear sentence by sentence instead of staring at "Searching…" for the
// entire remaining duration. Cache hits skip all of this and write the full
// cached summary in one shot.
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

  const jobTitleKey = normalizeJobTitle(jobTitle);
  const encoder = new TextEncoder();

  // Cache check — a query error here (e.g. migration 0053 not run yet)
  // falls straight through to the live search path below, same graceful
  // degrade used everywhere else in this app for newer tables.
  const { data: cached } = await supabase
    .from("key_trends_cache")
    .select("summary, generated_at")
    .eq("job_title_key", jobTitleKey)
    .maybeSingle<{ summary: string; generated_at: string }>();
  if (cached) {
    const ageHours = (Date.now() - new Date(cached.generated_at).getTime()) / 3_600_000;
    if (ageHours < CACHE_TTL_HOURS) {
      return new Response(encoder.encode(cached.summary), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Trends-Cached": "true" },
      });
    }
  }

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      let searchError: Anthropic.WebSearchToolResultErrorCode | null = null;

      try {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          // Was 10 — the prompt already asks for "2-4 searches," this just
          // makes that a hard ceiling instead of a suggestion, bounding
          // worst-case first-time latency instead of trusting the model to
          // stop on its own.
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
          messages: [
            {
              role: "user",
              content: `Search the web for real, current information and summarize 3-5 trends relevant to someone working as "${jobTitle}" right now — things like in-demand skills, tools or technologies gaining adoption, hiring/market shifts, or emerging responsibilities in that field. Be efficient: 2-4 well-chosen searches covering the field broadly is usually enough — you don't need a separate search per trend. Only include things you can back with a real source you found. Format as a short bulleted list (one bullet per trend, 1-2 sentences each), and end each bullet with the source in parentheses, e.g. "(source: example.com)". Do not fabricate specifics or present a guess as fact.`,
            },
          ],
        });

        // Web search errors don't throw — they arrive as a web_search_tool_result
        // content block whose content is an error object instead of a result
        // list. That block always lands (fully formed, not delta-streamed)
        // before any final-answer text block, so catching it here — before
        // forwarding any text — prevents Claude's own "I couldn't search"
        // explanation from leaking to the client as if it were a real result.
        for await (const event of stream) {
          if (
            event.type === "content_block_start" &&
            event.content_block.type === "web_search_tool_result" &&
            !Array.isArray(event.content_block.content)
          ) {
            searchError = (event.content_block.content as Anthropic.WebSearchToolResultError).error_code;
            console.error("Web search tool error:", searchError);
            continue;
          }
          if (searchError) continue;
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            reply += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        console.error("Trends generation failed:", err);
        if (!reply && !searchError) {
          controller.enqueue(encoder.encode("Could not fetch trends right now — please try again."));
        }
        controller.close();
        return;
      }

      if (searchError) {
        controller.enqueue(
          encoder.encode(SEARCH_ERROR_MESSAGES[searchError] ?? "Could not search for trends right now.")
        );
        controller.close();
        return;
      }

      if (!reply.trim()) {
        controller.enqueue(encoder.encode("Could not generate trends right now — please try again."));
        controller.close();
        return;
      }

      controller.close();

      // Best-effort — a cache write failure shouldn't fail the response the
      // user is already looking at.
      await supabase
        .from("key_trends_cache")
        .upsert({ job_title_key: jobTitleKey, job_title: jobTitle.trim(), summary: reply, generated_at: new Date().toISOString() })
        .then(
          () => {},
          () => {}
        );
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
