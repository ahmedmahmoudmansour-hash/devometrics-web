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
    // Anything generated before this fix shipped may be a broken fragment
    // from either the narration-leak bug or the block-position-guessing
    // bug the two-phase request replaced — never serve it, regardless of
    // the normal 7-day TTL. No SQL cleanup needed: every affected row is
    // simply too old to pass this check, and a fresh (correct) generation
    // overwrites it on the next request. Safe to delete this cutoff once
    // enough time has passed that no pre-fix rows remain.
    const FIX_DEPLOYED_AT = new Date("2026-08-13T00:00:00Z").getTime();
    const isPreFix = new Date(cached.generated_at).getTime() < FIX_DEPLOYED_AT;
    if (ageHours < CACHE_TTL_HOURS && !isPreFix) {
      return new Response(encoder.encode(cached.summary), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Trends-Cached": "true" },
      });
    }
  }

  const searchTool = { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 4 };
  const userPrompt = `Search the web for real, current information and summarize 3-5 trends relevant to someone working as "${jobTitle}" right now — things like in-demand skills, tools or technologies gaining adoption, hiring/market shifts, or emerging responsibilities in that field. Be efficient: 2-4 well-chosen searches covering the field broadly is usually enough — you don't need a separate search per trend. Only include things you can back with a real source you found. Format as a short bulleted list (one bullet per trend, 1-2 sentences each), and end each bullet with the source in parentheses, e.g. "(source: example.com)". Do not fabricate specifics or present a guess as fact.`;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Two-phase request instead of one long tool-use conversation.
      // Phase 1 (below) lets Claude search freely — its interleaved text
      // here is throwaway narration ("Let me search for X") that we never
      // show. Phase 2 is a fresh turn with tool_choice "none": Claude
      // can't invoke the search tool again, so its response can only be
      // plain text — nothing to filter, buffer, or guess about.
      //
      // The previous single-phase approach tried to detect "the real
      // answer" by discarding buffered text every time a new text block
      // started, on the assumption only the LAST block was final. That
      // broke whenever Claude did a legitimate verification search partway
      // through writing the answer (observed live: a 5-bullet answer where
      // the last bullet triggered one more search, and the reset-on-new-
      // block logic threw away bullets 1-4, leaving only a stray sentence
      // fragment and a trailing "Note:" caveat). There's no reliable way
      // to tell "narration before a search" from "the real answer,
      // interrupted by a search" from block position alone — so this
      // removes the need to guess entirely.
      try {
        const researchResponse = await anthropic.messages.create({
          model: "claude-sonnet-5",
          max_tokens: 2048,
          tools: [searchTool],
          messages: [{ role: "user", content: userPrompt }],
        });

        const errorBlock = researchResponse.content.find(
          (b): b is Anthropic.WebSearchToolResultBlock => b.type === "web_search_tool_result" && !Array.isArray(b.content)
        );
        if (errorBlock) {
          const errorCode = (errorBlock.content as Anthropic.WebSearchToolResultError).error_code;
          console.error("Web search tool error:", errorCode);
          controller.enqueue(encoder.encode(SEARCH_ERROR_MESSAGES[errorCode] ?? "Could not search for trends right now."));
          controller.close();
          return;
        }

        // A research phase cut off mid-tool-call by max_tokens can leave
        // malformed content blocks that aren't safe to replay as history
        // in phase 2 — bail out rather than risk a broken follow-up call.
        if (researchResponse.stop_reason === "max_tokens") {
          console.error("Trends research phase hit max_tokens, discarding");
          controller.enqueue(encoder.encode("Could not generate trends right now — please try again."));
          controller.close();
          return;
        }

        const stream = anthropic.messages.stream({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          tools: [searchTool],
          tool_choice: { type: "none" },
          messages: [
            { role: "user", content: userPrompt },
            { role: "assistant", content: researchResponse.content as Anthropic.MessageParam["content"] },
            {
              role: "user",
              content:
                "Now write only the final trends summary, exactly as instructed — a short bulleted list (3-5 bullets, 1-2 sentences each), each ending with the source in parentheses. Nothing else: no search narration, no caveats or notes about source quality, nothing before or after the list.",
            },
          ],
        });

        let finalText = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            finalText += event.delta.text;
          }
        }

        // A suspiciously short answer (e.g. cut off by hitting max_tokens
        // mid-sentence) is worse than no answer — it reads as broken
        // output, not "try again." A real 3-5-bullet trends summary is
        // always well over 100 characters, so anything under a generous
        // floor is treated the same as empty: shown as a retry message,
        // and — critically — never cached, so one bad generation can't
        // keep serving the same broken fragment to everyone else searching
        // that job title for the next 7 days.
        const MIN_VALID_LENGTH = 80;
        if (!finalText.trim() || finalText.trim().length < MIN_VALID_LENGTH) {
          console.error("Trends response suspiciously short, discarding:", JSON.stringify(finalText));
          controller.enqueue(encoder.encode("Could not generate trends right now — please try again."));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(finalText));
        controller.close();

        // Best-effort — a cache write failure shouldn't fail the response
        // the user is already looking at.
        await supabase
          .from("key_trends_cache")
          .upsert({ job_title_key: jobTitleKey, job_title: jobTitle.trim(), summary: finalText, generated_at: new Date().toISOString() })
          .then(
            () => {},
            () => {}
          );
      } catch (err) {
        console.error("Trends generation failed:", err);
        controller.enqueue(encoder.encode("Could not fetch trends right now — please try again."));
        controller.close();
      }
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
