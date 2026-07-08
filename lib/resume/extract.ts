import Anthropic from "@anthropic-ai/sdk";
import { sanitizeResumeAnalysis, type ResumeAnalysisResult } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECORD_TOOL = {
  name: "record_resume_analysis",
  description: "Record a structured resume analysis covering ATS compatibility, keyword gap, achievement quality, and visibility recommendations in one pass.",
  input_schema: {
    type: "object" as const,
    properties: {
      atsScore: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "0-100, how well an ATS parser would likely handle this resume's structure (clear section headers, consistent formatting cues, no parsing traps)",
      },
      atsIssues: {
        type: "array",
        items: { type: "string" },
        description: "Specific structural/formatting issues found (e.g. missing a Skills section, inconsistent date formats, unclear headers) — not generic advice",
      },
      achievementScore: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "0-100, how much of the resume uses quantified, outcome-oriented achievement language vs. vague duty-listing",
      },
      matchedKeywords: {
        type: "array",
        items: { type: "string" },
        description: "Skills/keywords already well-represented in the resume, relevant to the target role if given, otherwise to the candidate's apparent field",
      },
      missingKeywords: {
        type: "array",
        items: { type: "string" },
        description: "Important skills/keywords absent from the resume that would strengthen it for the target role or field",
      },
      weakBullets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string", description: "The exact weak bullet as written in the resume" },
            issue: { type: "string", description: "1 sentence on why it's weak (e.g. no quantified outcome, passive voice, vague verb)" },
            rewrite: { type: "string", description: "A concrete rewrite grounded in the same underlying fact — do not invent numbers or achievements not implied by the original" },
          },
          required: ["original", "issue", "rewrite"],
        },
        description: "The specific bullets that most need improvement, not every bullet in the resume",
      },
      visibilityRecommendations: {
        type: "array",
        items: { type: "string" },
        description: "Concrete, specific fixes to make this resume more discoverable and compelling — not generic 'improve your resume' advice",
      },
    },
    required: [
      "atsScore",
      "atsIssues",
      "achievementScore",
      "matchedKeywords",
      "missingKeywords",
      "weakBullets",
      "visibilityRecommendations",
    ],
  },
};

export async function extractResumeAnalysis({
  resumeText,
  targetRole,
}: {
  resumeText: string;
  targetRole: string | null;
}): Promise<ResumeAnalysisResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: `You are the Devometrics Resume Intelligence engine. Analyze the resume across four dimensions in a single pass: ATS compatibility, keyword gap, achievement quality, and visibility.

Ground every finding in the actual resume text — do not invent bullets, numbers, or achievements that aren't there. When rewriting a weak bullet, only strengthen its phrasing/structure; never fabricate a metric or outcome the original doesn't support. If a target role is provided, weight keyword analysis against it; otherwise infer the candidate's field from the resume itself and use general industry-standard keywords.

Be specific, not generic — "add more keywords" is not a valid finding, "add 'stakeholder management' — it appears in 4 of your listed responsibilities but is never named" is.`,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_resume_analysis" },
    messages: [
      {
        role: "user",
        content: `TARGET ROLE: ${targetRole || "Not specified — infer field from the resume itself"}\n\nRESUME:\n${resumeText}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }

  return sanitizeResumeAnalysis(toolUse.input as ResumeAnalysisResult);
}
