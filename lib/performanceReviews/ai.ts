"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import type { GapAnalysis } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TEXT = 3000;

type ReviewContext = { organizationId: string; employeeUserId: string };

// "For admin" in the name is legacy — a real reporting-line manager who
// isn't an org admin can use these too (migration 0078), same as they can
// now submit the Manager's Perspective itself. Checked explicitly here
// rather than just trusting that the row was readable, since RLS SELECT
// visibility and "should get AI drafting help" happen to align today but
// aren't the same guarantee to lean on silently.
async function loadReviewForAdmin(reviewId: string): Promise<{ error: string } | { supabase: Awaited<ReturnType<typeof createClient>>; ctx: ReviewContext }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: review } = await supabase
    .from("performance_reviews")
    .select("organization_id, employee_user_id")
    .eq("id", reviewId)
    .maybeSingle<{ organization_id: string; employee_user_id: string }>();
  if (!review) return { error: "Review not found" };

  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    supabase.rpc("is_org_admin", { check_org_id: review.organization_id }),
    supabase.rpc("is_manager_of_user", { target_user_id: review.employee_user_id }),
  ]);
  if (!isAdmin && !isManager) return { error: "Not authorized" };

  return { supabase, ctx: { organizationId: review.organization_id, employeeUserId: review.employee_user_id } };
}

async function latestGapAnalysisSummary(supabase: Awaited<ReturnType<typeof createClient>>, employeeUserId: string): Promise<string> {
  const { data: analysis } = await supabase
    .from("gap_analyses")
    .select("target_role, competencies")
    .eq("user_id", employeeUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<GapAnalysis, "target_role" | "competencies">>();
  if (!analysis) return "No Gap Analysis on file for this person yet.";

  const lines = analysis.competencies
    .slice()
    .sort((a, b) => b.gapSize - a.gapSize)
    .map((c) => `- ${c.dimension}: currently ${c.currentLevel}/100, target ${c.targetLevel}/100 (gap ${c.gapSize}, ${c.priority} priority)`);
  return `Most recent Gap Analysis, targeting "${analysis.target_role}":\n${lines.join("\n")}`;
}

export type FocusAreaSuggestion = { title: string; description: string };

const FOCUS_AREAS_TOOL = {
  name: "record_focus_areas",
  description: "Record 2-4 suggested Focus Areas for this person's Impact Cycle.",
  input_schema: {
    type: "object" as const,
    properties: {
      focusAreas: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string", description: "Short, concrete focus area — an outcome or capability, not a vague aspiration" },
            description: { type: "string", description: "1-2 sentences on what doing this well looks like" },
          },
          required: ["title", "description"],
        },
      },
    },
    required: ["focusAreas"],
  },
};

// Draft only — the admin picks which suggestions (if any) to actually add
// via addReviewGoal, same "propose, review, edit, save" posture as Job
// Architecture's suggestRoleGrading. Never auto-inserted.
export async function suggestFocusAreas(reviewId: string): Promise<{ error: string } | { suggestions: FocusAreaSuggestion[] }> {
  const loaded = await loadReviewForAdmin(reviewId);
  if ("error" in loaded) return loaded;
  const { supabase, ctx } = loaded;

  const [gapSummary, { data: existingGoals }, { data: self }] = await Promise.all([
    latestGapAnalysisSummary(supabase, ctx.employeeUserId),
    supabase.from("performance_review_goals").select("title").eq("review_id", reviewId).returns<{ title: string }[]>(),
    supabase.from("performance_review_self_assessments").select("reflection").eq("review_id", reviewId).maybeSingle<{ reflection: string | null }>(),
  ]);

  const existingTitles = (existingGoals ?? []).map((g) => g.title);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system:
        "You are a manager's assistant drafting candidate Focus Areas for someone's Impact Cycle (a performance review period). Ground every suggestion in the measured gap-analysis data given — prioritize their highest-gap, highest-priority dimensions. Never invent facts about their work that weren't provided. This is a draft an admin will review, edit, and choose which to keep — not a final decision.",
      tools: [FOCUS_AREAS_TOOL],
      tool_choice: { type: "tool", name: "record_focus_areas" },
      messages: [
        {
          role: "user",
          content: `${gapSummary}\n\n${self?.reflection ? `Their self-reflection this cycle:\n${self.reflection.slice(0, MAX_TEXT)}\n\n` : ""}${existingTitles.length > 0 ? `Focus Areas already set (don't repeat these): ${existingTitles.join(", ")}` : "No Focus Areas set yet."}`,
        },
      ],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = (toolUse.input as { focusAreas: FocusAreaSuggestion[] }).focusAreas ?? [];
    return { suggestions: raw.slice(0, 4) };
  } catch (err) {
    console.error("suggestFocusAreas failed:", err);
    return { error: "Couldn't generate suggestions right now — try again in a moment." };
  }
}

const MANAGER_PERSPECTIVE_TOOL = {
  name: "record_manager_perspective",
  description: "Record a draft Manager's Perspective (rating + written feedback + development needs) for this Impact Cycle.",
  input_schema: {
    type: "object" as const,
    properties: {
      rating: { type: "integer", minimum: 1, maximum: 5, description: "Suggested rating 1-5, grounded in the evidence given" },
      feedback: { type: "string", description: "2-4 sentences of specific, constructive feedback — reference the actual Focus Areas and gap data given, not generic praise" },
      developmentNeeds: { type: "string", description: "1-2 sentences on what skill-building or support would help them grow from here, framed as an opportunity — grounded in their lowest/highest-gap dimensions" },
    },
    required: ["rating", "feedback", "developmentNeeds"],
  },
};

// Draft only — the admin reviews and edits the rating, text, and
// development needs before calling submitManagerAssessment. Framed to the
// model as evidence-based drafting, same posture as this whole platform's
// other AI features (decision support, never an automated verdict).
export async function draftManagerPerspective(reviewId: string): Promise<{ error: string } | { rating: number; feedback: string; developmentNeeds: string }> {
  const loaded = await loadReviewForAdmin(reviewId);
  if ("error" in loaded) return loaded;
  const { supabase, ctx } = loaded;

  const [gapSummary, { data: goals }, { data: self }] = await Promise.all([
    latestGapAnalysisSummary(supabase, ctx.employeeUserId),
    supabase.from("performance_review_goals").select("title, status").eq("review_id", reviewId).returns<{ title: string; status: string }[]>(),
    supabase.from("performance_review_self_assessments").select("rating, reflection").eq("review_id", reviewId).maybeSingle<{ rating: number | null; reflection: string | null }>(),
  ]);

  const goalLines = (goals ?? []).map((g) => `- ${g.title}: ${g.status.replace("_", " ")}`);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system:
        "You are helping a manager draft their Perspective (rating + feedback + development needs) for someone's Impact Cycle. Ground everything strictly in the measured Gap Analysis data, the person's own self-reflection (if given), and their Focus Area statuses — never invent achievements or shortcomings that aren't evidenced. This is a first draft the manager will personally review and edit before sharing; it should read as genuinely specific, not generic corporate praise. Development needs should read as an opportunity, not a deficiency.",
      tools: [MANAGER_PERSPECTIVE_TOOL],
      tool_choice: { type: "tool", name: "record_manager_perspective" },
      messages: [
        {
          role: "user",
          content: [
            gapSummary,
            goalLines.length > 0 ? `Focus Areas this cycle:\n${goalLines.join("\n")}` : "No Focus Areas were set this cycle.",
            self?.reflection
              ? `Their self-reflection${self.rating ? ` (self-rated ${self.rating}/5)` : ""}:\n${self.reflection.slice(0, MAX_TEXT)}`
              : "They haven't submitted a self-reflection yet.",
          ].join("\n\n"),
        },
      ],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as { rating: number; feedback: string; developmentNeeds: string };
    return { rating: Math.min(5, Math.max(1, Math.round(raw.rating))), feedback: raw.feedback ?? "", developmentNeeds: raw.developmentNeeds ?? "" };
  } catch (err) {
    console.error("draftManagerPerspective failed:", err);
    return { error: "Couldn't generate a draft right now — try again in a moment." };
  }
}

export type CompetencyRatingSuggestion = { dimension: string; rating: number; note: string };

const COMPETENCY_RATINGS_TOOL = {
  name: "record_competency_ratings",
  description: "Record suggested manager competency ratings (1-5) for this Impact Cycle, one per dimension.",
  input_schema: {
    type: "object" as const,
    properties: {
      ratings: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            dimension: { type: "string", enum: [...COMPETENCY_DIMENSIONS] },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            note: { type: "string", description: "1 sentence grounding the rating in the evidence given" },
          },
          required: ["dimension", "rating", "note"],
        },
      },
    },
    required: ["ratings"],
  },
};

// Starting point only — translates the measured 0-100 Gap Analysis levels
// plus this cycle's own evidence into a 1-5 rating per dimension, but the
// admin adjusts every one of these individually before saving (via
// setCompetencyRating), same as every other AI suggestion in this feature.
export async function suggestCompetencyRatings(reviewId: string): Promise<{ error: string } | { suggestions: CompetencyRatingSuggestion[] }> {
  const loaded = await loadReviewForAdmin(reviewId);
  if ("error" in loaded) return loaded;
  const { supabase, ctx } = loaded;

  const [gapSummary, { data: self }] = await Promise.all([
    latestGapAnalysisSummary(supabase, ctx.employeeUserId),
    supabase.from("performance_review_self_assessments").select("reflection").eq("review_id", reviewId).maybeSingle<{ reflection: string | null }>(),
  ]);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system:
        `You are proposing starting-point manager competency ratings (1=Needs Development, 2=Developing, 3=Meets Expectations, 4=Exceeds Expectations, 5=Outstanding) for this Impact Cycle, one per dimension: ${COMPETENCY_DIMENSIONS.join(", ")}. Translate the measured Gap Analysis levels (0-100 scale) into this 1-5 scale sensibly, adjusted by their self-reflection where it adds real signal. These are drafts a manager will individually review and adjust — never invent evidence.`,
      tools: [COMPETENCY_RATINGS_TOOL],
      tool_choice: { type: "tool", name: "record_competency_ratings" },
      messages: [
        {
          role: "user",
          content: `${gapSummary}\n\n${self?.reflection ? `Their self-reflection this cycle:\n${self.reflection.slice(0, MAX_TEXT)}` : "No self-reflection submitted yet."}`,
        },
      ],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const validDims = new Set<string>(COMPETENCY_DIMENSIONS);
    const raw = (toolUse.input as { ratings: CompetencyRatingSuggestion[] }).ratings ?? [];
    return {
      suggestions: raw
        .filter((r) => validDims.has(r.dimension))
        .map((r) => ({ dimension: r.dimension, rating: Math.min(5, Math.max(1, Math.round(r.rating))), note: r.note ?? "" })),
    };
  } catch (err) {
    console.error("suggestCompetencyRatings failed:", err);
    return { error: "Couldn't generate suggestions right now — try again in a moment." };
  }
}

// Drafts the closing Conclusion by synthesizing everything already on
// record for this cycle — the admin still has to review and edit it, then
// explicitly call closeReview themselves. Nothing here is auto-applied.
export async function draftConclusion(reviewId: string): Promise<{ error: string } | { conclusion: string }> {
  const loaded = await loadReviewForAdmin(reviewId);
  if ("error" in loaded) return loaded;
  const { supabase } = loaded;

  const [{ data: self }, { data: manager }, { data: goals }, { data: ratings }] = await Promise.all([
    supabase.from("performance_review_self_assessments").select("rating, reflection").eq("review_id", reviewId).maybeSingle<{ rating: number | null; reflection: string | null }>(),
    supabase.from("performance_review_manager_assessments").select("rating, feedback, development_needs").eq("review_id", reviewId).maybeSingle<{ rating: number | null; feedback: string | null; development_needs: string | null }>(),
    supabase.from("performance_review_goals").select("title, status").eq("review_id", reviewId).returns<{ title: string; status: string }[]>(),
    supabase.from("performance_review_competency_ratings").select("dimension, rating").eq("review_id", reviewId).returns<{ dimension: string; rating: number }[]>(),
  ]);

  if (!manager) {
    return { error: "Submit the Manager's Perspective first — there's nothing to summarize yet." };
  }

  const parts = [
    self?.reflection ? `Employee's self-reflection (self-rated ${self.rating ?? "—"}/5):\n${self.reflection.slice(0, MAX_TEXT)}` : "No self-reflection on record.",
    manager?.feedback ? `Manager's Perspective (rated ${manager.rating ?? "—"}/5):\n${manager.feedback}` : "No Manager's Perspective on record.",
    manager?.development_needs ? `Development needs identified:\n${manager.development_needs}` : "",
    goals && goals.length > 0 ? `Focus Areas:\n${goals.map((g) => `- ${g.title}: ${g.status.replace("_", " ")}`).join("\n")}` : "",
    ratings && ratings.length > 0 ? `Competency ratings:\n${ratings.map((r) => `- ${r.dimension}: ${r.rating}/5`).join("\n")}` : "",
  ].filter(Boolean);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system:
        "Write a short closing Conclusion (3-5 sentences) for this Impact Cycle, synthesizing the self-reflection, Manager's Perspective, Focus Area outcomes, and competency ratings given. Balanced and specific — name what actually happened, not generic praise. This is a draft the manager will edit before closing the cycle.",
      messages: [{ role: "user", content: parts.join("\n\n") }],
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text output");
    return { conclusion: text.text.trim() };
  } catch (err) {
    console.error("draftConclusion failed:", err);
    return { error: "Couldn't draft this right now — try again in a moment." };
  }
}

// Employee-side: turns their own rough notes into a polished first-person
// reflection paragraph — never fabricates content, only rephrases what they
// already gave it. Same "organize a note" pattern as Workspace's AI
// summarizer, applied to a review reflection instead of a free note.
export async function helpDraftReflection(reviewId: string, roughNotes: string): Promise<{ error: string } | { reflection: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: review } = await supabase
    .from("performance_reviews")
    .select("employee_user_id")
    .eq("id", reviewId)
    .maybeSingle<{ employee_user_id: string }>();
  if (!review || review.employee_user_id !== user.id) return { error: "Not authorized" };

  const trimmed = roughNotes.trim().slice(0, MAX_TEXT);
  if (!trimmed) return { error: "Add a few rough notes first" };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system:
        "Turn this person's rough notes into a clear, first-person reflection paragraph for their own performance review. Use only what they actually wrote — never add accomplishments, numbers, or claims they didn't mention. Keep their voice; don't inflate it into corporate-speak. Plain text only, no headers or bullet points.",
      messages: [{ role: "user", content: trimmed }],
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text output");
    return { reflection: text.text.trim() };
  } catch (err) {
    console.error("helpDraftReflection failed:", err);
    return { error: "Couldn't draft this right now — try again in a moment." };
  }
}
