import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }],
      messages: [
        {
          role: "user",
          content: `Search the web for 3-5 real, currently-available courses (or structured learning paths) on "${topic}".${formatHint} For each one, name the actual institution or platform offering it (e.g. Coursera, a specific university, LinkedIn Learning, a bootcamp) and briefly note the format and rough cost if you can find it (free, paid, or a real price). Only include courses you can back with a real source you found — do not invent course names or institutions. Format as a short bulleted list, one course per bullet, ending with the source in parentheses.`,
        },
      ],
    });

    const searchError = response.content.find(
      (block): block is Anthropic.WebSearchToolResultBlock =>
        block.type === "web_search_tool_result" && !Array.isArray(block.content)
    );
    if (searchError) {
      const errorCode = (searchError.content as Anthropic.WebSearchToolResultError).error_code;
      console.error("Course search tool error:", errorCode);
      return NextResponse.json(
        { error: SEARCH_ERROR_MESSAGES[errorCode] ?? "Could not search for courses right now" },
        { status: 502 }
      );
    }

    const summary = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n")
      .trim();

    if (!summary) {
      return NextResponse.json({ error: "Could not find course recommendations right now" }, { status: 502 });
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Course recommendation generation failed:", err);
    return NextResponse.json({ error: "Could not fetch course recommendations right now" }, { status: 502 });
  }
}
