import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Same fix and same reasoning as /api/trends — without this, Vercel kills
// the function at its platform default (well under a minute), which is too
// short for two sequential model calls where phase 1 alone can involve
// several rounds of Claude Sonnet 5's code-execution-based search
// orchestration. 60s is plan-agnostic — Vercel clamps down to the
// account's actual ceiling if this exceeds it.
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

// Same grounded-in-real-search pattern as /api/trends -- a milestone like
// "AI skills workshop" is a topic, not a course catalog we maintain
// ourselves, so this searches the web for real, named courses with real
// institutions rather than letting the model invent plausible-sounding ones.
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

  // Was 10 — each search can now involve multiple internal code-execution
  // rounds (see maxDuration comment above), so this bounds worst-case
  // latency more tightly. Still generous enough for a 3-5 course list.
  const searchTool = { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 6 };
  const userPrompt = `Search the web for 3-5 real, currently-available courses (or structured learning paths) on "${topic}".${formatHint} For each one, name the actual institution or platform offering it (e.g. Coursera, a specific university, LinkedIn Learning, a bootcamp) and briefly note the format and rough cost if you can find it (free, paid, or a real price). Only include courses you can back with a real source you found — do not invent course names or institutions. Format as a short bulleted list, one course per bullet, ending with the source in parentheses.`;

  try {
    // Two-phase request — same fix and same reasoning as /api/trends.
    // Phase 1 lets Claude search freely and narrate as much as it wants;
    // that text is thrown away, only the tool results matter. Phase 2 is a
    // fresh turn with tool_choice "none" so Claude can't call the search
    // tool again, meaning its response can only be plain text — no risk of
    // a mid-answer verification search silently discarding earlier bullets
    // (the failure mode the old "only the last text block is real"
    // heuristic couldn't reliably detect).
    const researchResponse = await anthropic.messages.create({
      model: "claude-sonnet-5",
      // Claude Sonnet 5's web search runs through an internal code-execution
      // sandbox — it writes and runs small Python snippets to call searches
      // and parse results, sometimes retrying when it misparses its own
      // output. A real research phase can burn 30+ content blocks (thinking
      // + code cells + search results) before it ever gets to the answer —
      // same fix as /api/trends, same root cause confirmed by reproducing
      // the failure directly against the API.
      max_tokens: 4096,
      tools: [searchTool],
      messages: [{ role: "user", content: userPrompt }],
    });

    const errorBlock = researchResponse.content.find(
      (block): block is Anthropic.WebSearchToolResultBlock =>
        block.type === "web_search_tool_result" && !Array.isArray(block.content)
    );
    if (errorBlock) {
      const errorCode = (errorBlock.content as Anthropic.WebSearchToolResultError).error_code;
      console.error("Course search tool error:", errorCode);
      return NextResponse.json(
        { error: SEARCH_ERROR_MESSAGES[errorCode] ?? "Could not search for courses right now" },
        { status: 502 }
      );
    }

    // A research phase cut off mid-tool-call by max_tokens can leave
    // malformed content blocks that aren't safe to replay as history in
    // phase 2 — bail out rather than risk a broken follow-up call.
    if (researchResponse.stop_reason === "max_tokens") {
      console.error("Course research phase hit max_tokens, discarding");
      return NextResponse.json({ error: "Could not find course recommendations right now" }, { status: 502 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1536,
      tools: [searchTool],
      tool_choice: { type: "none" },
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: researchResponse.content as Anthropic.MessageParam["content"] },
        {
          role: "user",
          content:
            "Now write only the final course list, exactly as instructed — a short bulleted list, one course per bullet, ending with the source in parentheses. Nothing else: no search narration, no caveats, nothing before or after the list.",
        },
      ],
    });
    await recordAiUsage(supabase, {
      organizationId,
      userId: user.id,
      feature: "course_recommendations",
      model: response.model,
      inputTokens: researchResponse.usage.input_tokens + response.usage.input_tokens,
      outputTokens: researchResponse.usage.output_tokens + response.usage.output_tokens,
    });

    const summary = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    // A suspiciously short answer (e.g. cut off by hitting max_tokens
    // mid-sentence) is worse than no answer. A real 3-5-course list is
    // always well over 100 characters, so anything under a generous floor
    // is treated as failed.
    const MIN_VALID_LENGTH = 80;
    if (!summary || summary.length < MIN_VALID_LENGTH) {
      console.error("Course recommendations suspiciously short, discarding:", JSON.stringify(summary));
      return NextResponse.json({ error: "Could not find course recommendations right now" }, { status: 502 });
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Course recommendation generation failed:", err);
    return NextResponse.json({ error: "Could not fetch course recommendations right now" }, { status: 502 });
  }
}
