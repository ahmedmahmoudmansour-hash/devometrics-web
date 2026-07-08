import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExerciseReport = {
  score: number;
  strengths: string[];
  gaps: string[];
  recommendation: string;
};

const RECORD_TOOL = {
  name: "record_exercise_report",
  description: "Score a written response to a timed Assessment Centre case study and produce a structured feedback report.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "0-100, how effectively the response demonstrates the target competency — judged on reasoning, specificity, and whether tradeoffs were actually named, not on writing quality or length.",
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
        description: "1-3 specific things the response did well, each referencing something actually written, not generic praise.",
      },
      gaps: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
        description: "1-3 specific things the response missed or underdeveloped — a tradeoff not addressed, a stakeholder not considered, reasoning left implicit.",
      },
      recommendation: {
        type: "string",
        description: "1-2 sentences of concrete advice for what to sharpen next time, grounded in this specific response.",
      },
    },
    required: ["score", "strengths", "gaps", "recommendation"],
  },
};

export async function scoreCaseStudyExercise({
  dimension,
  context,
  prompt,
  responseText,
}: {
  dimension: string;
  context: string;
  prompt: string;
  responseText: string;
}): Promise<ExerciseReport> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: `You are scoring a timed Assessment Centre case study response for Devometrics, targeting the "${dimension}" competency. This is a heuristic judgment call, not a validated psychometric instrument. Score based on the concreteness and rigor of the reasoning actually shown — did the person name the real tradeoff, consider the people affected, make an actual decision rather than hedge? A short, decisive, well-reasoned answer should score as well as a longer one. Never invent detail the person didn't write, and never fabricate specifics about the scenario beyond what was given.`,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_exercise_report" },
    messages: [
      {
        role: "user",
        content: `CASE CONTEXT:\n${context}\n\nPROMPT:\n${prompt}\n\nRESPONSE:\n${responseText}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }

  const result = toolUse.input as ExerciseReport;
  return {
    score: Math.max(0, Math.min(100, Math.round(result.score))),
    strengths: result.strengths,
    gaps: result.gaps,
    recommendation: result.recommendation,
  };
}
