import Anthropic from "@anthropic-ai/sdk";
import { COMPETENCY_DIMENSIONS, sanitizeCompetencyScores, type CompetencyScore } from "./dimensions";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECORD_TOOL = {
  name: "record_gap_analysis",
  description:
    "Record a structured competency gap analysis scoring the candidate against the target role.",
  input_schema: {
    type: "object" as const,
    properties: {
      competencies: {
        type: "array" as const,
        minItems: COMPETENCY_DIMENSIONS.length,
        maxItems: COMPETENCY_DIMENSIONS.length,
        items: {
          type: "object" as const,
          properties: {
            dimension: { type: "string", enum: [...COMPETENCY_DIMENSIONS] },
            currentLevel: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "0-100, the candidate's current level based on evidence in the CV",
            },
            targetLevel: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "0-100, the level the target role realistically demands",
            },
            importance: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "0-100, how much this dimension matters for the target role",
            },
            marketDemand: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "0-100, how in-demand this dimension is in the broader job market",
            },
            gapSize: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "0-100, targetLevel minus currentLevel",
            },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            confidence: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description:
                "0-100, how confident you are in currentLevel given the evidence available in the CV. Lower this when the CV gives little or no signal for this dimension — do not default to high confidence.",
            },
            rationale: {
              type: "string",
              description: "1-2 sentences citing specific evidence from the CV or its absence",
            },
          },
          required: [
            "dimension",
            "currentLevel",
            "targetLevel",
            "importance",
            "marketDemand",
            "gapSize",
            "priority",
            "confidence",
            "rationale",
          ],
        },
      },
    },
    required: ["competencies"],
  },
};

export async function extractCompetencies({
  cvText,
  jobDescription,
  targetRole,
  performanceData,
}: {
  cvText: string;
  jobDescription: string;
  targetRole: string;
  performanceData?: string | null;
}): Promise<CompetencyScore[]> {
  const response = await anthropic.messages.create({
    model: "claude-fable-5",
    max_tokens: 4096,
    system: `You are the Devometrics competency extraction engine. Score the candidate against the target role across exactly these ${COMPETENCY_DIMENSIONS.length} fixed dimensions: ${COMPETENCY_DIMENSIONS.join(", ")}.

FRAMEWORK: Ground your scoring approach in established competency-science, not free-floating judgment. Specifically: use behaviorally-anchored reasoning in the style of Boyatzis' competency model (score what a person actually demonstrably does, not traits or potential), draw on the breadth of dimensions covered by SHL's Universal Competency Framework and O*NET's occupational competency taxonomy when judging what "Technical Skills," "Leadership," "Strategic Thinking," etc. concretely look like at different levels, and apply the same current-vs-target gap logic used in structured competency-gap methodologies. Do not cite specific papers, journals, or publication years — you do not have live access to any research database, and naming a specific citation you cannot verify would be fabrication. Naming the general, well-established frameworks above is honest; inventing a specific recent study is not.

The candidate's background material may be a formal CV, or it may be a student's coursework, class projects, internships, or extracurricular experience — treat all of these as legitimate evidence, not just paid work history. If performance review data or stated objectives are also provided, treat that as a distinct, often more current and specific evidence source than the CV — performance reviews frequently describe actual demonstrated behavior with more precision than a resume bullet does, so weigh it accordingly rather than treating it as secondary.

Ground every score in specific evidence from the background material provided. Do not invent accomplishments or skills that aren't supported by the text. When the material gives little or no signal for a dimension — which is expected and normal for students or early-career candidates — say so plainly in the rationale and lower the confidence score accordingly rather than guessing a mid-range number to look complete. A low score from thin evidence is not a judgment on the person; it reflects what's currently demonstrable, and confidence should say that. This confidence score is shown directly to the user, so it must be honest.`,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_gap_analysis" },
    messages: [
      {
        role: "user",
        content: `TARGET ROLE:\n${targetRole}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE BACKGROUND (CV, coursework, or project experience):\n${cvText}${
          performanceData?.trim() ? `\n\nPERFORMANCE REVIEW DATA / OBJECTIVES:\n${performanceData}` : ""
        }`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }

  const { competencies } = toolUse.input as { competencies: CompetencyScore[] };
  if (!Array.isArray(competencies) || competencies.length === 0) {
    throw new Error("Model returned no competency scores");
  }
  const sanitized = sanitizeCompetencyScores(competencies);
  // sanitizeCompetencyScores drops any entry whose dimension name doesn't
  // exactly match one of the fixed COMPETENCY_DIMENSIONS labels — the check
  // above only guards the raw (pre-filter) array, so a response where every
  // entry had a mismatched dimension label would previously sail through as
  // an empty array here. careerHealthScore([]) returns exactly 0, which
  // then got saved and shown as if it were a real (catastrophic) score
  // instead of failing loudly.
  if (sanitized.length === 0) {
    throw new Error("Model returned competency scores with no recognized dimensions");
  }
  return sanitized;
}
