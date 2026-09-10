import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import { resolveCallerLocale } from "@/lib/i18n/request";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// See app/api/trends/route.ts for the full story — same rewrite, same
// reasoning: this was a two-phase call with web_search_20260209 (code-
// execution search, measured at 116-200s+ and silently killed by Vercel,
// which is why "Find courses" returned nothing). Now a single call with
// the BASIC web_search_20250305 tool: ~15s end to end for the same job.
export const maxDuration = 60;

const MAX_TOPIC_LENGTH = 200;

const SEARCH_ERROR_MESSAGES: Record<Anthropic.WebSearchToolResultErrorCode, string> = {
  too_many_requests: "Course search is rate-limited right now — please try again in a few minutes.",
  max_uses_exceeded: "Reached the search limit for this request — please try again.",
  query_too_long: "That topic is too long to search — try a shorter version.",
  request_too_large: "The request was too large to search — try a shorter topic.",
  invalid_tool_input: "Could not run that search — please try again.",
  unavailable: "Web search is temporarily unavailable — please try again shortly.",
};

// Same grounded-in-real-search pattern as /api/trends — a milestone like
// "AI skills workshop" is a topic, not a course catalog we maintain
// ourselves, so this searches the web for real, named courses with real
// institutions rather than letting the model invent plausible ones.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { topic, format } = (await request.json()) as { topic?: string; format?: string };
  if (!topic?.trim()) {
    return NextResponse.json({ error: "A topic is required" }, { status: 400 });
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: "Topic is too long" }, { status: 400 });
  }

  const formatHint = format ? ` The person prefers ${format.toLowerCase()}-style learning where possible.` : "";

  const membership = await getMyOrganizationMembership();
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) {
    return NextResponse.json({ error: budgetCheck.error }, { status: 402 });
  }

  const locale = await resolveCallerLocale(supabase, user.id);

  const searchTool = { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 4 };
  const userPrompt = `Search the web for 3-5 real, currently-available courses (or structured learning paths) on "${topic}".${formatHint} For each one, name the actual institution or platform offering it (e.g. Coursera, a specific university, LinkedIn Learning, a bootcamp) and briefly note the format and rough cost if you can find it (free, paid, or a real price). Only include courses you can back with a real source you found — do not invent course names or institutions. Output ONLY a bulleted list, one course per bullet, each ending with the source in parentheses. No preamble, no heading, no closing note.${locale === "ar" ? " Write the entire list in Modern Standard Arabic (Fusha) — the course descriptions and prose, not just a translated label — regardless of what language your search results come back in." : ""}`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-5",
          max_tokens: 1536,
          tools: [searchTool],
          messages: [{ role: "user", content: userPrompt }],
        });

        let summary = "";
        let searchErrorCode: Anthropic.WebSearchToolResultErrorCode | null = null;
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "web_search_tool_result") {
            const c = event.content_block.content;
            if (!Array.isArray(c) && c && typeof c === "object" && "error_code" in c) {
              searchErrorCode = (c as Anthropic.WebSearchToolResultError).error_code;
            }
          }
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            summary += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        if (searchErrorCode && !summary) {
          console.error("Course search tool error:", searchErrorCode);
          controller.enqueue(encoder.encode(SEARCH_ERROR_MESSAGES[searchErrorCode] ?? "Could not search for courses right now"));
          controller.close();
          return;
        }

        const MIN_VALID_LENGTH = 80;
        if (!summary.trim() || summary.trim().length < MIN_VALID_LENGTH) {
          console.error("Course recommendations suspiciously short, discarding:", JSON.stringify(summary));
          if (!summary) controller.enqueue(encoder.encode("Could not find course recommendations right now"));
          controller.close();
          return;
        }

        controller.close();

        // Best-effort — usage tracking must never break the response the
        // user is already reading. finalMessage() resolves immediately
        // here (the stream already ended in the loop above).
        try {
          const finalMessage = await stream.finalMessage();
          await recordAiUsage(supabase, {
            organizationId,
            userId: user.id,
            feature: "course_recommendations",
            model: finalMessage.model,
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          });
        } catch (usageErr) {
          console.error("Course recommendations usage tracking failed (non-fatal):", usageErr);
        }
      } catch (err) {
        console.error("Course recommendation generation failed:", err);
        controller.enqueue(encoder.encode("Could not fetch course recommendations right now"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
