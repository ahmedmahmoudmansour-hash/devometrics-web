"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import type { SuccessionCandidate, SuccessionReport } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;

export async function createSuccessionRole(title: string, description: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };

  const trimmedTitle = title.trim().slice(0, MAX_TITLE);
  if (!trimmedTitle) return { error: "Give the role a title" };

  const { error } = await supabase.from("succession_roles").insert({
    organization_id: data.organizationId,
    title: trimmedTitle,
    description: description.trim().slice(0, MAX_DESCRIPTION),
    created_by: user.id,
  });
  if (error) {
    console.error("createSuccessionRole failed:", error);
    return { error: "Could not create the role — the database may need migration 0052 run first." };
  }
  revalidatePath("/dashboard/company/succession");
  return { success: true };
}

export async function deleteSuccessionRole(roleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS restricts this to admins of the role's own org — a non-admin's
  // delete simply matches zero rows.
  await supabase.from("succession_roles").delete().eq("id", roleId);
  revalidatePath("/dashboard/company/succession");
  return { success: true };
}

const RANKING_TOOL = {
  name: "record_succession_ranking",
  description: "Rank internal candidates for a critical role based on their real competency data.",
  input_schema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "array",
        maxItems: 8,
        description:
          "Employees ranked best-fit first. Include ONLY people with a plausible path to this role — ranking everyone dilutes the signal. Can be empty if no one fits.",
        items: {
          type: "object",
          properties: {
            userId: { type: "string", description: "The candidate's userId exactly as given in the data." },
            name: { type: "string" },
            fitScore: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description:
                "Fit for THIS role today, grounded in their measured competency levels — not seniority, not tenure, not optimism.",
            },
            readiness: {
              type: "string",
              description: "'Ready now', or a realistic time horizon like '6-12 months' / '1-2 years'.",
            },
            strengths: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
              description: "Their strongest evidence for this role, citing actual competency data.",
            },
            gaps: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
              description: "What specifically would need to develop before they're ready.",
            },
            developmentFocus: {
              type: "string",
              description: "One sentence: the single highest-leverage development priority for this candidate.",
            },
            whyRanked: {
              type: "string",
              description: "1-2 sentences explaining this ranking position, referencing their data.",
            },
          },
          required: ["userId", "name", "fitScore", "readiness", "strengths", "gaps", "developmentFocus", "whyRanked"],
        },
      },
      riskNote: {
        type: "string",
        description:
          "1-2 sentences of succession-risk assessment for this role: bench strength, single-points-of-failure, data quality caveats (e.g. few employees have run assessments).",
      },
      hasStrongSuccessor: {
        type: "boolean",
        description: "True only if at least one candidate is genuinely ready now or near-ready with high confidence.",
      },
    },
    required: ["candidates", "riskNote", "hasStrongSuccessor"],
  },
};

export async function generateSuccessionReport(roleId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };

  const { data: role } = await supabase
    .from("succession_roles")
    .select("id, title, description, organization_id")
    .eq("id", roleId)
    .eq("organization_id", data.organizationId)
    .maybeSingle<{ id: string; title: string; description: string; organization_id: string }>();
  if (!role) return { error: "Role not found" };

  if (data.rows.length === 0) {
    return { error: "No employees to evaluate yet — invite your team first." };
  }

  const workforce = data.rows
    .map((r) => {
      const dims = Object.entries(r.dimensionLevels)
        .map(([d, v]) => `${d}: ${v}/100`)
        .join(", ");
      return [
        `userId: ${r.userId}`,
        `name: ${r.name}`,
        r.title ? `current title: ${r.title}` : null,
        r.department ? `department: ${r.department}` : null,
        dims ? `measured competencies: ${dims}` : "measured competencies: none (no Gap Analysis run yet)",
        `career health score: ${r.careerHealthScore ?? "n/a"}`,
        `assessments completed: ${r.assessmentsCompleted}`,
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");

  let report: SuccessionReport;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system:
        "You evaluate internal succession candidates for Devometrics' enterprise talent platform. This is DECISION SUPPORT for HR, never an automated decision — your rankings inform a human conversation. Ground every judgment in the measured competency data provided; never invent qualifications, tenure, or performance history that isn't in the data. Where the data is thin (employees without Gap Analyses), say so in the risk note rather than guessing. Do not consider or mention age, gender, nationality, or anything other than the competency evidence provided.",
      tools: [RANKING_TOOL],
      tool_choice: { type: "tool", name: "record_succession_ranking" },
      messages: [
        {
          role: "user",
          content: `CRITICAL ROLE: ${role.title}\n\nROLE REQUIREMENTS (as described by the admin):\n${role.description || "(no description provided — infer sensible requirements from the title)"}\n\nWORKFORCE DATA:\n${workforce}`,
        },
      ],
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as Omit<SuccessionReport, "generatedAt">;
    const validIds = new Set(data.rows.map((r) => r.userId));
    report = {
      generatedAt: new Date().toISOString(),
      candidates: (raw.candidates ?? [])
        .filter((c): c is SuccessionCandidate => !!c && validIds.has(c.userId))
        .map((c) => ({ ...c, fitScore: Math.max(0, Math.min(100, Math.round(c.fitScore))) })),
      riskNote: raw.riskNote ?? "",
      hasStrongSuccessor: !!raw.hasStrongSuccessor,
    };
  } catch (err) {
    console.error("generateSuccessionReport failed:", err);
    return { error: "Couldn't generate the ranking right now — try again in a moment." };
  }

  const { error } = await supabase
    .from("succession_roles")
    .update({ report, generated_at: report.generatedAt })
    .eq("id", roleId);
  if (error) return { error: "Could not save the report — try again." };

  revalidatePath("/dashboard/company/succession");
  return { success: true };
}
