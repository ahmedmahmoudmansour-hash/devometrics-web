"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS, sanitizeCompetencyScores, type CompetencyDimension, type CompetencyScore } from "@/lib/gap-analysis/dimensions";
import { computePromotionReadiness } from "./readiness";
import type { GapAnalysis } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type WhatIfResult = {
  scenario: string;
  currentReadiness: number;
  projectedReadiness: number;
  delta: number;
  topGapsAfter: { dimension: string; gapSize: number }[];
};

async function loadLatestAnalysis(): Promise<{ error: string } | { analysis: GapAnalysis }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: analysis } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GapAnalysis>();
  if (!analysis) return { error: "Run a Gap Analysis first — there's nothing to simulate against yet." };

  return { analysis };
}

function toResult(scenario: string, current: CompetencyScore[], projected: CompetencyScore[]): WhatIfResult {
  const currentReadiness = computePromotionReadiness(current) ?? 0;
  const projectedReadiness = computePromotionReadiness(projected) ?? 0;
  const topGapsAfter = [...projected]
    .sort((a, b) => b.gapSize - a.gapSize)
    .slice(0, 3)
    .map((c) => ({ dimension: c.dimension, gapSize: c.gapSize }));
  return {
    scenario,
    currentReadiness,
    projectedReadiness,
    delta: projectedReadiness - currentReadiness,
    topGapsAfter,
  };
}

const RETARGET_TOOL = {
  name: "record_role_requirements",
  description: "Record what a different target role requires, per competency dimension.",
  input_schema: {
    type: "object" as const,
    properties: {
      requirements: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            dimension: { type: "string", enum: [...COMPETENCY_DIMENSIONS] },
            targetLevel: { type: "integer", minimum: 0, maximum: 100, description: "How much this dimension matters for READINESS in the new role, 0-100" },
            importance: { type: "integer", minimum: 0, maximum: 100, description: "How much this dimension matters for SELECTION into the new role, 0-100" },
          },
          required: ["dimension", "targetLevel", "importance"],
        },
      },
    },
    required: ["requirements"],
  },
};

// "What if I targeted a different role?" — deliberately does NOT re-measure
// the person (their currentLevel per dimension stays exactly what the last
// real Gap Analysis measured). The only thing that changes is what "ready"
// means for the new role — a much lighter, cheaper AI call than a full
// re-scoring, and one that can't accidentally inflate or deflate their
// actual measured standing.
export async function simulateTargetRoleChange(newTargetRole: string): Promise<{ error: string } | WhatIfResult> {
  const loaded = await loadLatestAnalysis();
  if ("error" in loaded) return loaded;
  const { analysis } = loaded;

  const trimmedRole = newTargetRole.trim().slice(0, 120);
  if (!trimmedRole) return { error: "Enter a role to simulate" };

  const currentSummary = analysis.competencies
    .map((c) => `- ${c.dimension}: currently measured at ${c.currentLevel}/100`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system:
        "For the hypothetical target role given, state what each competency dimension would need to look like for someone to be ready for and selected into that role — targetLevel (how much readiness it demands) and importance (how much it factors into selection). Do not comment on or infer the person's own ability; you're only defining the role's requirements. Use ONLY the exact dimension names given.",
      tools: [RETARGET_TOOL],
      tool_choice: { type: "tool", name: "record_role_requirements" },
      messages: [
        { role: "user", content: `HYPOTHETICAL TARGET ROLE: ${trimmedRole}\n\nDimensions to define requirements for:\n${currentSummary}` },
      ],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = (toolUse.input as { requirements: { dimension: string; targetLevel: number; importance: number }[] }).requirements ?? [];
    const reqByDim = new Map(raw.map((r) => [r.dimension, r]));

    const projected: CompetencyScore[] = analysis.competencies.map((c) => {
      const req = reqByDim.get(c.dimension);
      return {
        ...c,
        targetLevel: req?.targetLevel ?? c.targetLevel,
        importance: req?.importance ?? c.importance,
      };
    });
    const sanitized = sanitizeCompetencyScores(projected);

    return toResult(`If you targeted "${trimmedRole}"`, analysis.competencies, sanitized);
  } catch (err) {
    console.error("simulateTargetRoleChange failed:", err);
    return { error: "Couldn't simulate that role right now — try again in a moment." };
  }
}

// "What if I improved one dimension?" — fully deterministic, no AI call:
// bump that dimension's measured current level by the stated amount, capped
// at its existing target, and recompute readiness against the SAME target
// role already on file.
export async function simulateDimensionImprovement(
  dimension: CompetencyDimension,
  deltaPoints: number
): Promise<{ error: string } | WhatIfResult> {
  const loaded = await loadLatestAnalysis();
  if ("error" in loaded) return loaded;
  const { analysis } = loaded;

  const clampedDelta = Math.min(50, Math.max(1, Math.round(deltaPoints)));
  const projected: CompetencyScore[] = analysis.competencies.map((c) =>
    c.dimension === dimension
      ? { ...c, currentLevel: Math.min(c.targetLevel, c.currentLevel + clampedDelta), gapSize: Math.max(0, c.targetLevel - Math.min(c.targetLevel, c.currentLevel + clampedDelta)) }
      : c
  );

  return toResult(`If you improved ${dimension} by ${clampedDelta} points`, analysis.competencies, projected);
}
