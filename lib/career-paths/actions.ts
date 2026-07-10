"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { isRateLimitExempt } from "@/lib/rateLimit/isExempt";
import type { CareerPathBranch, GapAnalysis, Profile } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Regeneration is a full Claude call — once per hour is plenty for a map
// that changes when the user's profile/gap analysis changes, not by the
// minute.
const REGENERATE_COOLDOWN_MINUTES = 60;

const PATHS_TOOL = {
  name: "record_career_paths",
  description: "Map realistic career path branches for a professional based on their actual background.",
  input_schema: {
    type: "object" as const,
    properties: {
      currentRole: {
        type: "string",
        description: "Their current role/position in a few words, inferred from their background.",
      },
      branches: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        description:
          "2-4 distinct path directions actually plausible from this background — e.g. a leadership/management path, a deep-expertise path, a cross-functional or adjacent-field path. Only include an executive path if their seniority makes it a realistic horizon.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short branch name, e.g. 'Leadership Path'." },
            description: {
              type: "string",
              description: "One sentence on what this direction means for this specific person.",
            },
            nodes: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              description: "1-3 successive roles along this branch, nearest first.",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", description: "Realistic role title." },
                  readinessPercent: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                    description:
                      "How ready they are TODAY for this role, grounded in their competency levels and experience — not aspirational. Later nodes in a branch should be lower than earlier ones.",
                  },
                  requiredSkills: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 5,
                    description: "The competencies/skills this role genuinely requires.",
                  },
                  gaps: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 4,
                    description:
                      "Their specific current gaps for this role, grounded in the gap-analysis data provided — empty if genuinely ready.",
                  },
                  estimatedTime: {
                    type: "string",
                    description:
                      "Realistic time to readiness from today, e.g. '6-12 months', '2-3 years'. 'Ready now' if readiness is very high.",
                  },
                  whyThisPath: {
                    type: "string",
                    description:
                      "1-2 sentences: why this role is a plausible next step for THIS person, referencing their actual background.",
                  },
                },
                required: ["role", "readinessPercent", "requiredSkills", "gaps", "estimatedTime", "whyThisPath"],
              },
            },
          },
          required: ["name", "description", "nodes"],
        },
      },
    },
    required: ["currentRole", "branches"],
  },
};

export async function generateCareerPaths(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: profile }, { data: analysis }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase
      .from("gap_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<GapAnalysis>(),
    supabase
      .from("career_paths")
      .select("generated_at")
      .eq("user_id", user.id)
      .maybeSingle<{ generated_at: string }>(),
  ]);

  if (existing && !(await isRateLimitExempt(supabase, user.id))) {
    const ageMinutes = (Date.now() - new Date(existing.generated_at).getTime()) / 60000;
    if (ageMinutes < REGENERATE_COOLDOWN_MINUTES) {
      return { error: "Your map was generated recently — update your profile or run a new Gap Analysis first, then regenerate in a little while." };
    }
  }

  const jobHistory = (profile?.job_history ?? [])
    .map((j) => `- ${j.title} at ${j.company} (${j.duration}): ${j.description}`)
    .join("\n");
  const competencies = (analysis?.competencies ?? [])
    .map((c) => `- ${c.dimension}: current ${c.currentLevel}/100, target ${c.targetLevel}/100 (gap ${c.gapSize})`)
    .join("\n");

  const background = [
    profile?.career_stage ? `CAREER STAGE: ${profile.career_stage}` : null,
    jobHistory ? `JOB HISTORY:\n${jobHistory}` : null,
    (profile?.skills ?? []).length ? `SKILLS: ${(profile?.skills ?? []).join(", ")}` : null,
    profile?.career_aspirations ? `THEIR OWN STATED ASPIRATIONS: ${profile.career_aspirations}` : null,
    analysis ? `LATEST GAP ANALYSIS — target role "${analysis.target_role}", Career Health Score ${analysis.career_health_score}/100:\n${competencies}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!background.trim()) {
    return { error: "There's nothing to build a map from yet — fill in your career profile or run a Gap Analysis first." };
  }

  let currentRole: string;
  let branches: CareerPathBranch[];
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      system:
        "You map realistic career paths for a professional on Devometrics, a career-development platform. Ground every judgment in the background actually provided — never invent employers, roles they didn't hold, or skills they didn't list. Readiness percentages must reflect their real competency data, not optimism. Do NOT include salary figures anywhere — the platform deliberately excludes compensation claims it cannot source.",
      tools: [PATHS_TOOL],
      tool_choice: { type: "tool", name: "record_career_paths" },
      messages: [{ role: "user", content: background }],
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as { currentRole: string; branches: CareerPathBranch[] };
    currentRole = raw.currentRole;
    branches = raw.branches;
  } catch (err) {
    console.error("generateCareerPaths failed:", err);
    return { error: "Could not generate your map right now — try again in a moment." };
  }

  const { error } = await supabase.from("career_paths").upsert({
    user_id: user.id,
    paths: { currentRole, branches },
    generated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("career_paths upsert failed:", error);
    return { error: "Could not save your map — try again." };
  }

  revalidatePath("/dashboard/career-paths");
  return { success: true };
}
