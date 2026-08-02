"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import type { ExitInterview, ExitInterviewAnalysis, ExitInterviewAnalysisRecord } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MIN_INTERVIEWS_FOR_ANALYSIS = 3;

const ANALYSIS_TOOL = {
  name: "record_exit_interview_analysis",
  description: "Identify root-cause themes and turnover patterns across a set of exit interviews.",
  input_schema: {
    type: "object" as const,
    properties: {
      topThemes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            theme: { type: "string", description: "Short label, e.g. 'Management concerns', 'Compensation', 'Lack of growth opportunities'" },
            count: { type: "integer", description: "How many interviews raised this theme" },
            example: { type: "string", description: "A short, anonymized paraphrase of a representative comment — never a verbatim quote that could identify who said it" },
          },
          required: ["theme", "count", "example"],
        },
        maxItems: 6,
      },
      managerRelatedTurnover: {
        type: "string",
        description: "2-3 sentences: is there a pattern of departures tied to specific managers or management style in general? Say so plainly if the data doesn't support this, rather than forcing a finding.",
      },
      departmentTrends: {
        type: "string",
        description: "2-3 sentences on which departments show elevated turnover or recurring complaints, if any pattern exists in the data provided.",
      },
      flightRiskIndicators: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
        description: "Concrete, observable early-warning signals (from what departing employees actually said) that could help spot at-risk current employees — not generic HR advice.",
      },
      summary: {
        type: "string",
        description: "3-4 sentence executive summary of the overall attrition picture across these interviews.",
      },
    },
    required: ["topThemes", "managerRelatedTurnover", "departmentTrends", "flightRiskIndicators", "summary"],
  },
};

export async function analyzeExitInterviewThemes(): Promise<{ analysis?: ExitInterviewAnalysis; interviewCount?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const { data: interviews } = await supabase
    .from("exit_interviews")
    .select("*")
    .eq("organization_id", company.organizationId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ExitInterview[]>();

  if (!interviews || interviews.length < MIN_INTERVIEWS_FOR_ANALYSIS) {
    return { error: `Record at least ${MIN_INTERVIEWS_FOR_ANALYSIS} exit interviews before running trend analysis — a meaningful pattern needs more than one or two data points.` };
  }

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId: company.organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  const context = interviews
    .map((iv, i) => {
      const qa = iv.responses.map((r) => `  Q: ${r.question}\n  A: ${r.answer}`).join("\n");
      return [
        `INTERVIEW ${i + 1}`,
        `Department: ${iv.department ?? "unspecified"}`,
        `Title: ${iv.title ?? "unspecified"}`,
        `Separation type: ${iv.separation_type}`,
        qa,
        iv.additional_notes ? `Additional notes: ${iv.additional_notes}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system:
        "You analyze exit interviews for an HR team to identify root causes of turnover. This is DECISION SUPPORT, never an automated conclusion — HR reads your analysis alongside their own judgment. Ground every claim strictly in what's actually in the interview text provided; never invent a pattern that isn't supported by the data, and say so plainly when the sample is too thin or mixed to support a clear finding. Never include anything that could identify a specific departed employee by name in your output — paraphrase and anonymize.",
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: "record_exit_interview_analysis" },
      messages: [{ role: "user", content: `EXIT INTERVIEWS (${interviews.length} total):\n\n${context}` }],
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const analysis = toolUse.input as ExitInterviewAnalysis;

    await recordAiUsage(supabase, {
      organizationId: company.organizationId,
      userId: user.id,
      feature: "exit_interview_analysis",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    await supabase.from("exit_interview_analyses").insert({
      organization_id: company.organizationId,
      analysis,
      interview_count: interviews.length,
      generated_by: user.id,
    });

    revalidatePath("/dashboard/company/exit-interviews");
    return { analysis, interviewCount: interviews.length };
  } catch (err) {
    console.error("analyzeExitInterviewThemes failed:", err);
    return { error: "Couldn't generate the analysis right now — try again in a moment." };
  }
}

export async function getLatestExitInterviewAnalysis(): Promise<ExitInterviewAnalysisRecord | null> {
  const supabase = await createClient();
  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return null;

  const { data } = await supabase
    .from("exit_interview_analyses")
    .select("*")
    .eq("organization_id", company.organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ExitInterviewAnalysisRecord>();
  return data ?? null;
}
