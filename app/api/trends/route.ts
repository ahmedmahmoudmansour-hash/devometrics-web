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
      // Only the LAST text block is the real answer. With the server-side
      // web_search tool, Claude can narrate between search rounds — e.g.
      // "Let me search for X" before the first search, "Good, I have solid
      // sources, let me extract the relevant content" between rounds — and
      // each of those is its own real text content block, not a "thinking"
      // block that's filtered out automatically. The bug this replaced
      // forwarded every text_delta live as it arrived, so that in-between
      // narration streamed straight to the user ahead of (and mixed in
      // with) the actual bulleted summary. A new text content_block_start
      // means whatever was buffered before it was mid-search commentary,
      // not the final answer, so it's discarded; whatever's left in the
      // buffer once the stream ends is the true final block.
      let finalText = "";
      let searchError: Anthropic.WebSearchToolResultErrorCode | null = null;

      try {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-5",
          // max_tokens is a hard ceiling across the WHOLE response, not just
          // the final answer — it also has to cover every discarded
          // narration block ("Let me search for X", "Good, I have solid
          // sources...") between search rounds. At 1024 those rounds could
          // eat most of the budget before Claude ever got to write the real
          // answer, truncating it mid-sentence (observed live: a response
          // that cut off after two words). Raised to give real headroom for
          // narration + a complete 3-5-bullet answer with sources.
          max_tokens: 2048,
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
          if (event.type === "content_block_start" && event.content_block.type === "text") {
            finalText = "";
            continue;
          }
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            finalText += event.delta.text;
          }
        }
      } catch (err) {
        console.error("Trends generation failed:", err);
        if (!finalText && !searchError) {
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

      // A suspiciously short "final" block (e.g. cut off by hitting
      // max_tokens mid-sentence, or any other stream truncation) is worse
      // than no answer — it reads as broken output, not "try again." A
      // real 3-5-bullet trends summary is always well over 100 characters,
      // so anything under a generous floor is treated the same as empty:
      // shown as a retry message, and — critically — never cached, so one
      // bad generation can't keep serving the same broken fragment to
      // everyone else searching that job title for the next 7 days.
      const MIN_VALID_LENGTH = 80;
      if (!finalText.trim() || finalText.trim().length < MIN_VALID_LENGTH) {
        console.error("Trends response suspiciously short, discarding:", JSON.stringify(finalText));
        controller.enqueue(encoder.encode("Could not generate trends right now — please try again."));
        controller.close();
        return;
      }

      // Sent once the full answer is known, rather than live-forwarded
      // deltas — the streaming API is still used server-side (needed either
      // way to receive the multi-round tool-use response), but the client
      // now only ever sees the real final text, never intermediate search
      // narration. The "typed out" reveal is a UX tradeoff traded for
      // correctness; sends in one chunk instead of appearing sentence by
      // sentence.
      controller.enqueue(encoder.encode(finalText));
      controller.close();

      // Best-effort — a cache write failure shouldn't fail the response the
      // user is already looking at.
      await supabase
        .from("key_trends_cache")
        .upsert({ job_title_key: jobTitleKey, job_title: jobTitle.trim(), summary: finalText, generated_at: new Date().toISOString() })
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
