"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import type { CandidateRankingReport, RankedCandidate } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RANKING_TOOL = {
  name: "record_candidate_ranking",
  description: "Rank candidates for a job posting based on their CV competency scores and interview assessments.",
  input_schema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "array",
        description: "Every candidate given, ranked best-fit first.",
        items: {
          type: "object",
          properties: {
            candidateId: { type: "string", description: "The candidate's id exactly as given in the data." },
            name: { type: "string" },
            fitScore: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "Fit for this specific role, grounded in their CV competency scores and interview assessment where available.",
            },
            strengths: { type: "array", items: { type: "string" }, maxItems: 3, description: "Their strongest evidence for this role." },
            concerns: { type: "array", items: { type: "string" }, maxItems: 3, description: "What's missing, unproven, or a genuine risk." },
            recommendation: { type: "string", description: "1-2 sentences of concrete next-step guidance for the hiring team." },
            whyRanked: { type: "string", description: "1-2 sentences explaining this ranking position, referencing their actual data." },
          },
          required: ["candidateId", "name", "fitScore", "strengths", "concerns", "recommendation", "whyRanked"],
        },
      },
      riskNote: {
        type: "string",
        description: "1-2 sentences on the overall pipeline for this posting: data quality caveats (e.g. candidates with no CV score or no interview notes yet), or a thin pool.",
      },
      hasStrongCandidate: {
        type: "boolean",
        description: "True only if at least one candidate is a genuinely strong, well-evidenced fit.",
      },
    },
    required: ["candidates", "riskNote", "hasStrongCandidate"],
  },
};

// Compares every non-rejected candidate on a posting — modeled directly on
// generateSuccessionReport()'s ranking shape, including its bias-avoidance
// clause. Decision support for the hiring team, never an automated
// hire/no-hire decision.
export async function generateCandidateRanking(postingId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const company = await buildCompanyData();
  if (!company.isOrgAdmin || !company.organizationId) return { error: "Not authorized" };

  const { data: posting } = await supabase
    .from("job_postings")
    .select("id, title, job_description, organization_id")
    .eq("id", postingId)
    .eq("organization_id", company.organizationId)
    .maybeSingle<{ id: string; title: string; job_description: string; organization_id: string }>();
  if (!posting) return { error: "Posting not found" };

  const { data: candidates } = await supabase
    .from("hiring_candidates")
    .select("id, full_name, stage")
    .eq("posting_id", postingId)
    .neq("stage", "rejected")
    .returns<{ id: string; full_name: string; stage: string }[]>();
  if (!candidates || candidates.length === 0) {
    return { error: "No active candidates to rank yet — add candidates first." };
  }

  const candidateIds = candidates.map((c) => c.id);
  const [{ data: scores }, { data: assessments }] = await Promise.all([
    supabase
      .from("hiring_candidate_cv_scores")
      .select("candidate_id, career_health_score, competencies")
      .in("candidate_id", candidateIds)
      .returns<{ candidate_id: string; career_health_score: number; competencies: { dimension: string; currentLevel: number }[] }[]>(),
    supabase
      .from("hiring_candidate_assessments")
      .select("candidate_id, assessment")
      .in("candidate_id", candidateIds)
      .returns<{ candidate_id: string; assessment: { overallScore: number; strengths: string[]; concerns: string[] } }[]>(),
  ]);
  const scoreByCandidate = new Map((scores ?? []).map((s) => [s.candidate_id, s]));
  const assessmentByCandidate = new Map((assessments ?? []).map((a) => [a.candidate_id, a.assessment]));

  const candidateBlock = candidates
    .map((c) => {
      const score = scoreByCandidate.get(c.id);
      const assessment = assessmentByCandidate.get(c.id);
      const dims = score?.competencies?.length
        ? score.competencies.map((d) => `${d.dimension}: ${d.currentLevel}/100`).join(", ")
        : null;
      return [
        `candidateId: ${c.id}`,
        `name: ${c.full_name}`,
        `pipeline stage: ${c.stage}`,
        score ? `CV career health score: ${score.career_health_score}/100` : "CV: not scored yet",
        dims ? `CV competencies: ${dims}` : null,
        assessment
          ? `interview assessment score: ${assessment.overallScore}/100 | strengths: ${assessment.strengths.join("; ")} | concerns: ${assessment.concerns.join("; ")}`
          : "interview assessment: none yet",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");

  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId: company.organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  let report: CandidateRankingReport;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system:
        "You compare hiring candidates for a specific job posting on Devometrics' Smart Hiring feature. This is DECISION SUPPORT for the hiring team, never an automated hiring decision — your ranking informs a human conversation. Ground every judgment in the CV competency scores and interview assessment data given; never invent qualifications, answers, or behavior not in the data. Where a candidate has no CV score or no interview assessment yet, say so plainly rather than guessing favorably or unfavorably. Do not consider or mention age, gender, nationality, or anything other than the competency and interview evidence provided.",
      tools: [RANKING_TOOL],
      tool_choice: { type: "tool", name: "record_candidate_ranking" },
      messages: [
        {
          role: "user",
          content: `JOB POSTING: ${posting.title}\n\nJOB DESCRIPTION:\n${posting.job_description || "(none provided)"}\n\nCANDIDATES:\n${candidateBlock}`,
        },
      ],
    });
    await recordAiUsage(supabase, {
      organizationId: company.organizationId,
      userId: user.id,
      feature: "candidate_ranking",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as Omit<CandidateRankingReport, "generatedAt">;
    const validIds = new Set(candidates.map((c) => c.id));
    report = {
      generatedAt: new Date().toISOString(),
      candidates: (raw.candidates ?? [])
        .filter((c): c is RankedCandidate => !!c && validIds.has(c.candidateId))
        .map((c) => ({ ...c, fitScore: Math.max(0, Math.min(100, Math.round(c.fitScore))) })),
      riskNote: raw.riskNote ?? "",
      hasStrongCandidate: !!raw.hasStrongCandidate,
    };
  } catch (err) {
    console.error("generateCandidateRanking failed:", err);
    return { error: "Couldn't generate the ranking right now — try again in a moment." };
  }

  const { error } = await supabase
    .from("job_postings")
    .update({ ranking_report: report, ranking_generated_at: report.generatedAt })
    .eq("id", postingId);
  if (error) return { error: "Could not save the ranking — try again." };

  revalidatePath(`/dashboard/company/hiring/${postingId}`);
  return { success: true };
}
