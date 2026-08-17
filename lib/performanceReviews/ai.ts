"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import type { GapAnalysis } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TEXT = 3000;

// actingUserId is the admin/manager actually running this AI action — the
// one whose budget is charged — distinct from employeeUserId, whose Gap
// Analysis data is only being read as context.
type ReviewContext = { organizationId: string; employeeUserId: string; actingUserId: string };

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

  return {
    supabase,
    ctx: { organizationId: review.organization_id, employeeUserId: review.employee_user_id, actingUserId: user.id },
  };
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

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId: ctx.organizationId, userId: ctx.actingUserId });
  if (budgetCheck.error) return { error: budgetCheck.error };

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
    await recordAiUsage(supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.actingUserId,
      feature: "performance_review_ai",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const rawInput = (toolUse.input as { focusAreas: FocusAreaSuggestion[] }).focusAreas;
    const raw = Array.isArray(rawInput) ? rawInput : [];
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

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId: ctx.organizationId, userId: ctx.actingUserId });
  if (budgetCheck.error) return { error: budgetCheck.error };

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
    await recordAiUsage(supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.actingUserId,
      feature: "performance_review_ai",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
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

export type CompetencyRatingSuggestion = { dimension: string; rating: number; note: string; organizationCompetencyId?: string | null };

function buildCompetencyRatingsTool(labels: string[]) {
  return {
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
              dimension: { type: "string", enum: labels },
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
}

// Starting point only — translates the measured 0-100 Gap Analysis levels
// plus this cycle's own evidence into a 1-5 rating per dimension, but the
// admin adjusts every one of these individually before saving (via
// setCompetencyRating), same as every other AI suggestion in this feature.
//
// `options` mirrors a competency_ratings step's own configured pool
// (workflowTypes.ts CompetencyRatingsStepConfig) — when a step narrows to a
// subset of the 8 fixed dimensions and/or includes the org's own
// organization_competencies, the AI is only offered exactly that pool, never
// the full 8 by default once a step has been customized.
export async function suggestCompetencyRatings(
  reviewId: string,
  options?: { fixedDimensions?: string[]; organizationCompetencyIds?: string[] }
): Promise<{ error: string } | { suggestions: CompetencyRatingSuggestion[] }> {
  const loaded = await loadReviewForAdmin(reviewId);
  if ("error" in loaded) return loaded;
  const { supabase, ctx } = loaded;

  const dimensionPool = options?.fixedDimensions && options.fixedDimensions.length > 0 ? options.fixedDimensions : [...COMPETENCY_DIMENSIONS];

  let orgCompetencies: { id: string; name: string }[] = [];
  if (options?.organizationCompetencyIds && options.organizationCompetencyIds.length > 0) {
    const { data } = await supabase
      .from("organization_competencies")
      .select("id, name")
      .in("id", options.organizationCompetencyIds)
      .returns<{ id: string; name: string }[]>();
    orgCompetencies = data ?? [];
  }
  const orgCompetencyIdByName = new Map(orgCompetencies.map((c) => [c.name, c.id]));
  const labels = [...dimensionPool, ...orgCompetencies.map((c) => c.name)];

  const [gapSummary, { data: self }] = await Promise.all([
    latestGapAnalysisSummary(supabase, ctx.employeeUserId),
    supabase.from("performance_review_self_assessments").select("reflection").eq("review_id", reviewId).maybeSingle<{ reflection: string | null }>(),
  ]);

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId: ctx.organizationId, userId: ctx.actingUserId });
  if (budgetCheck.error) return { error: budgetCheck.error };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system:
        `You are proposing starting-point manager competency ratings (1=Needs Development, 2=Developing, 3=Meets Expectations, 4=Exceeds Expectations, 5=Outstanding) for this Impact Cycle, one per item in this list: ${labels.join(", ")}. Translate the measured Gap Analysis levels (0-100 scale) into this 1-5 scale sensibly for items that match a Gap Analysis dimension, adjusted by their self-reflection where it adds real signal; for any item with no direct Gap Analysis equivalent, use the self-reflection and general judgment instead. These are drafts a manager will individually review and adjust — never invent evidence.`,
      tools: [buildCompetencyRatingsTool(labels)],
      tool_choice: { type: "tool", name: "record_competency_ratings" },
      messages: [
        {
          role: "user",
          content: `${gapSummary}\n\n${self?.reflection ? `Their self-reflection this cycle:\n${self.reflection.slice(0, MAX_TEXT)}` : "No self-reflection submitted yet."}`,
        },
      ],
    });
    await recordAiUsage(supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.actingUserId,
      feature: "performance_review_ai",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const validLabels = new Set<string>(labels);
    const rawInput = (toolUse.input as { ratings: CompetencyRatingSuggestion[] }).ratings;
    const raw = Array.isArray(rawInput) ? rawInput : [];
    return {
      suggestions: raw
        .filter((r) => validLabels.has(r.dimension))
        .map((r) => ({
          dimension: r.dimension,
          rating: Math.min(5, Math.max(1, Math.round(r.rating))),
          note: r.note ?? "",
          organizationCompetencyId: orgCompetencyIdByName.get(r.dimension) ?? null,
        })),
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
  const { supabase, ctx } = loaded;

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

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId: ctx.organizationId, userId: ctx.actingUserId });
  if (budgetCheck.error) return { error: budgetCheck.error };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system:
        "Write a short closing Conclusion (3-5 sentences) for this Impact Cycle, synthesizing the self-reflection, Manager's Perspective, Focus Area outcomes, and competency ratings given. Balanced and specific — name what actually happened, not generic praise. This is a draft the manager will edit before closing the cycle.",
      messages: [{ role: "user", content: parts.join("\n\n") }],
    });
    await recordAiUsage(supabase, {
      organizationId: ctx.organizationId,
      userId: ctx.actingUserId,
      feature: "performance_review_ai",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text output");
    return { conclusion: text.text.trim() };
  } catch (err) {
    console.error("draftConclusion failed:", err);
    return { error: "Couldn't draft this right now — try again in a moment." };
  }
}

// Employee-side: turns their own rough notes about what support/resources/
// changes would help into a clear Recommendations paragraph. Deliberately
// NOT offered on Reflection, Key Strengths, or Development Areas — those
// exist specifically to capture the employee's own voice unassisted (an AI-
// polished self-reflection tells a manager nothing real about how someone
// actually sees their year), whereas Recommendations is closer to
// logistics — support needed, not personal disclosure — so drafting help
// there doesn't undercut the point of the field the way it would elsewhere.
// Never fabricates content, only organizes what they actually gave it —
// same "organize a note" pattern as Workspace's AI summarizer.
export async function helpDraftRecommendations(reviewId: string, roughNotes: string): Promise<{ error: string } | { recommendations: string }> {
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

  const membership = await getMyOrganizationMembership();
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        "Turn this person's rough notes into a clear, first-person Recommendations paragraph for their own performance review — support, resources, or changes that would help them going forward. Use only what they actually wrote — never add requests or claims they didn't mention. Keep their voice; don't inflate it into corporate-speak. Plain text only, no headers or bullet points.",
      messages: [{ role: "user", content: trimmed }],
    });
    await recordAiUsage(supabase, {
      organizationId,
      userId: user.id,
      feature: "performance_review_ai",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text output");
    return { recommendations: text.text.trim() };
  } catch (err) {
    console.error("helpDraftRecommendations failed:", err);
    return { error: "Couldn't draft this right now — try again in a moment." };
  }
}
