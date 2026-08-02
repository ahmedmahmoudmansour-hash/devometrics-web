"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import { gatherFlightRiskSignals, computeConfidence } from "./signals";
import type { FlightRiskScore } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FLIGHT_RISK_TOOL = {
  name: "record_flight_risk_assessment",
  description: "Assess one employee's flight risk using only the real signals provided.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: { type: "integer", description: "0-100. Higher means more likely to leave in the near term. Reflect genuine uncertainty in the middle of the range when signals are mixed or thin — don't force a confident-looking number the data doesn't support." },
      contributingFactors: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
        description: "Specific, concrete factors drawn strictly from the signals provided (e.g. 'High performer with no ready successor for their role', 'Milestone completion has stalled', 'Department has an elevated exit rate'). Never invent a factor the data doesn't support. If data is thin, say so as one of the factors rather than papering over it.",
      },
      suggestedActions: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
        description: "Concrete actions a manager could actually take, each grounded in one of the contributing factors above — not generic HR platitudes.",
      },
    },
    required: ["score", "contributingFactors", "suggestedActions"],
  },
};

export async function computeFlightRiskScore(employeeUserId: string): Promise<{ result?: FlightRiskScore; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const gathered = await gatherFlightRiskSignals(supabase, company, employeeUserId);
  if (!gathered) return { error: "Employee not found in your organization" };
  const { signals, managerNotes } = gathered;
  const confidence = computeConfidence(signals);

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId: company.organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  const employeeName = company.rows.find((r) => r.userId === employeeUserId)?.name ?? "This employee";

  const signalsText = [
    `Tenure: ${Math.round(signals.tenureDays / 30)} months`,
    `Department: ${signals.department ?? "unspecified"}`,
    `High Potential (9-box): ${signals.highPotential ? "yes" : "no"}`,
    `Nominated as a succession candidate: ${signals.successionNominee ? "yes" : "no"}`,
    `Current manager performance rating: ${signals.currentPerformanceRating !== null ? `${signals.currentPerformanceRating}/5` : "not rated"}`,
    `Active development plans: ${signals.activePlanCount}`,
    `Milestone completion rate: ${signals.milestoneCompletionRate !== null ? `${Math.round(signals.milestoneCompletionRate * 100)}%` : "no milestones yet"}`,
    `Survey participation rate: ${signals.surveyParticipationRate !== null ? `${Math.round(signals.surveyParticipationRate * 100)}%` : "none assigned"}`,
    `Manager notes on file: ${signals.managerNotesCount}`,
    `Past exit interviews from the same department: ${signals.departmentExitCount}`,
    `Past exit interviews citing the same manager: ${signals.managerExitCount}`,
  ].join("\n");

  const managerNotesBlock = managerNotes.length > 0 ? `\n\nMANAGER NOTES (verbatim, manager-authored only — never AI coach conversations):\n${managerNotes.join("\n---\n")}` : "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system:
        "You assess employee flight risk for an HR team's retention planning. This is DECISION SUPPORT, never an automated conclusion — a human reads this alongside their own judgment before acting. Ground every claim strictly in the signals provided; never invent a pattern, sentiment, or fact the data doesn't support, and say so plainly when the record is thin rather than forcing confidence. Never consider or mention age, gender, nationality, disability, or any protected characteristic — reason only from the professional/engagement signals given.",
      tools: [FLIGHT_RISK_TOOL],
      tool_choice: { type: "tool", name: "record_flight_risk_assessment" },
      messages: [{ role: "user", content: `EMPLOYEE: ${employeeName}\n\nSIGNALS:\n${signalsText}${managerNotesBlock}` }],
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as { score: number; contributingFactors: string[]; suggestedActions: string[] };

    await recordAiUsage(supabase, {
      organizationId: company.organizationId,
      userId: user.id,
      feature: "flight_risk_score",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const score = Math.max(0, Math.min(100, Math.round(raw.score)));

    const { data: inserted, error } = await supabase
      .from("employee_flight_risk_scores")
      .insert({
        organization_id: company.organizationId,
        employee_user_id: employeeUserId,
        score,
        confidence,
        contributing_factors: raw.contributingFactors ?? [],
        suggested_actions: raw.suggestedActions ?? [],
        signals_used: signals,
        generated_by: user.id,
      })
      .select()
      .single<FlightRiskScore>();
    if (error || !inserted) return { error: "Could not save the score — the database may need migration 0099 run first." };

    revalidatePath(`/dashboard/company/${employeeUserId}`);
    revalidatePath("/dashboard/company");
    return { result: inserted };
  } catch (err) {
    console.error("computeFlightRiskScore failed:", err);
    return { error: "Couldn't compute the score right now — try again in a moment." };
  }
}

export async function getLatestFlightRiskScore(employeeUserId: string): Promise<FlightRiskScore | null> {
  const supabase = await createClient();
  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return null;

  const { data } = await supabase
    .from("employee_flight_risk_scores")
    .select("*")
    .eq("organization_id", company.organizationId)
    .eq("employee_user_id", employeeUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<FlightRiskScore>();
  return data ?? null;
}

// For the CEO overview panel — only ever surfaces employees who've
// already been scored (opt-in per employee), never auto-scores the whole
// workforce, so AI spend stays admin-controlled rather than automatic.
export async function listHighFlightRiskEmployees(organizationId: string, options?: { minScore?: number; withinDays?: number }): Promise<{ employeeUserId: string; name: string; score: number }[]> {
  const supabase = await createClient();
  const minScore = options?.minScore ?? 70;
  const since = new Date(Date.now() - (options?.withinDays ?? 60) * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("employee_flight_risk_scores")
    .select("employee_user_id, score, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .returns<{ employee_user_id: string; score: number; created_at: string }[]>();

  const latestByEmployee = new Map<string, number>();
  for (const row of data ?? []) {
    if (!latestByEmployee.has(row.employee_user_id)) latestByEmployee.set(row.employee_user_id, row.score);
  }

  const company = await buildCompanyData();
  const nameById = new Map(company.rows.map((r) => [r.userId, r.name]));

  return [...latestByEmployee.entries()]
    .filter(([, score]) => score >= minScore)
    .map(([employeeUserId, score]) => ({ employeeUserId, name: nameById.get(employeeUserId) ?? "Unknown", score }));
}
