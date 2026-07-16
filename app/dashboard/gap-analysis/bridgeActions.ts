"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { BRIDGE_CONTENT_RATE_LIMIT_WINDOW_MINUTES, BRIDGE_CONTENT_RATE_LIMIT_MAX_RUNS } from "@/lib/limits";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import type { BridgeContent } from "@/lib/learning/bridgeContent";
import type { GapAnalysis } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BRIDGE_CONTENT_TOOL = {
  name: "record_bridge_content",
  description: "Produce curated development content to close one specific, measured competency gap.",
  input_schema: {
    type: "object" as const,
    properties: {
      diagnosticNote: {
        type: "string",
        description:
          "1-2 sentences offering a hypothesis for WHY this gap likely exists — a knowledge gap (doesn't know how), a practice gap (knows how, hasn't done it enough), or a context/systemic gap (environment doesn't give them the opportunity). Frame as a possibility worth discussing with a manager, not a certain diagnosis.",
      },
      recommendedActivity: {
        type: "string",
        description:
          "ONE clear, specific next action for this person to take this week — not a menu of options. Concrete and doable, not generic advice like 'practice more.'",
      },
      microLesson: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: {
            type: "string",
            description:
              "300-500 words of real, substantive teaching content specific to this dimension, this person's current level, and their target role — not a generic overview. Should read like a short, well-written lesson a good mentor would write, not marketing copy.",
          },
          knowledgeCheck: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                correctIndex: { type: "integer", minimum: 0, maximum: 3 },
              },
              required: ["question", "options", "correctIndex"],
            },
            description: "3 questions that check whether the micro-lesson above was actually understood, not trivia.",
          },
        },
        required: ["title", "body", "knowledgeCheck"],
      },
      reflectionQuestion: {
        type: "string",
        description: "One open-ended question prompting the person to connect this gap to their own real work situation.",
      },
      externalResources: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            source: { type: "string" },
            description: { type: "string" },
          },
          required: ["title", "url", "source", "description"],
        },
        description: "Reformat ONLY the verified resources provided in the prompt below — never invent additional ones not in that list.",
      },
    },
    required: ["diagnosticNote", "recommendedActivity", "microLesson", "reflectionQuestion", "externalResources"],
  },
};

const SEARCH_ERROR_FALLBACK = "(Web search for external resources was unavailable — none included this time.)";

export async function generateBridgeContent(dimension: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Two real Claude calls per run — this is the actual cost guard, not
  // just a UX nicety. Counts by generated_at (updated on every regenerate,
  // unlike created_at which only reflects the first insert) so repeatedly
  // clicking Regenerate on the same dimension is still bounded.
  if (!(await isRateLimitExempt(supabase, user.id))) {
    const windowStart = new Date(
      Date.now() - BRIDGE_CONTENT_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("gap_bridge_content")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("generated_at", windowStart);
    if ((recentCount ?? 0) >= BRIDGE_CONTENT_RATE_LIMIT_MAX_RUNS) {
      return { error: "You've generated several of these recently — please wait before generating another." };
    }
  }

  const { data: analysis } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GapAnalysis>();
  if (!analysis) return { error: "Run a Gap Analysis first." };

  const competency = analysis.competencies.find((c) => c.dimension === dimension);
  if (!competency) return { error: "That dimension wasn't part of your most recent Gap Analysis." };

  // Call 1: web-search-only, plain text — grounds external resources in
  // reality instead of letting the model invent plausible-sounding course
  // names. Same tool and reasoning as /api/trends. Split into its own call
  // (rather than mixing web_search with the forced structured tool below)
  // because forcing tool_choice to a specific custom tool from turn one
  // would preempt the model from searching first.
  let verifiedResourcesText = SEARCH_ERROR_FALLBACK;
  try {
    const searchResponse = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages: [
        {
          role: "user",
          content: `Search the web for 2-3 real, current, genuinely FREE learning resources (articles, official documentation, reputable videos, or recognized free courses — not paywalled content) that would help someone improve their "${dimension}" skills, specifically useful for someone working toward a "${competency.rationale ? competency.rationale + " — " : ""}${analysis.target_role}" role. They are currently measured at ${competency.currentLevel}/100, targeting ${competency.targetLevel}/100. Prefer credible sources: established publications, official docs, recognized free platforms (Khan Academy, freeCodeCamp, MIT OpenCourseWare, Google/Microsoft free training, HBR free articles, reputable YouTube channels from real institutions). For each, give: Title, exact URL, Source name, one-sentence description. Only include resources you can verify are real via search — never guess or fabricate a plausible-sounding one. If you can't find good free resources, say so plainly instead of making something up.`,
        },
      ],
    });
    const textBlocks = searchResponse.content.filter((b) => b.type === "text");
    const combined = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    if (combined) verifiedResourcesText = combined;
  } catch (err) {
    console.error("Bridge content resource search failed:", err);
    // Non-fatal — continues with the fallback text below rather than
    // failing the whole feature just because search didn't work.
  }

  // Call 2: structured synthesis, explicitly told to only use the
  // verified resources just gathered above.
  let content: BridgeContent;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2500,
      system:
        "You create personalized development content for Devometrics, a career-development platform. This is grounded, honest guidance — never invent facts, statistics, or resources that weren't given to you. The micro-lesson should be genuinely substantive (a real short lesson, not filler), and the external resources list must ONLY reformat the verified resources provided in the prompt — if none were found, return an empty array rather than inventing any.",
      tools: [BRIDGE_CONTENT_TOOL],
      tool_choice: { type: "tool", name: "record_bridge_content" },
      messages: [
        {
          role: "user",
          content: `COMPETENCY GAP TO BRIDGE\nDimension: ${dimension}\nCurrent level: ${competency.currentLevel}/100\nTarget level: ${competency.targetLevel}/100\nTarget role: ${analysis.target_role}\nWhy this gap matters (from the Gap Analysis): ${competency.rationale}\n\nVERIFIED EXTERNAL RESOURCES (from a real web search just now — only use these, do not add others):\n${verifiedResourcesText}`,
        },
      ],
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    content = toolUse.input as BridgeContent;
  } catch (err) {
    console.error("generateBridgeContent synthesis failed:", err);
    return { error: "Couldn't generate content right now — try again in a moment." };
  }

  const { error } = await supabase.from("gap_bridge_content").upsert(
    {
      user_id: user.id,
      dimension,
      target_role: analysis.target_role,
      current_level: competency.currentLevel,
      target_level: competency.targetLevel,
      content,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,dimension" }
  );
  if (error) return { error: "Could not save the content — the database may need migration 0064 run first." };

  revalidatePath(`/dashboard/gap-analysis/bridge/${encodeURIComponent(dimension)}`);
  return { success: true };
}
