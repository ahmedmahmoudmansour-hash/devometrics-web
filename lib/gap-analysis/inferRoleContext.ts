import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type RoleContext = {
  inferredJobDescription: string;
  estimatedTimelineMonths: number;
  timelineRationale: string;
};

const RECORD_TOOL = {
  name: "record_role_context",
  description: "Infer typical responsibilities/requirements for a named target role, and estimate a realistic timeline to reach it given the candidate's current background.",
  input_schema: {
    type: "object" as const,
    properties: {
      inferredJobDescription: {
        type: "string",
        description: "A realistic job-description-style paragraph (responsibilities, typical requirements, seniority signals) for this role title, grounded in well-known general knowledge of the role/level — not a fabricated posting from a specific real company.",
      },
      estimatedTimelineMonths: {
        type: "integer",
        minimum: 3,
        maximum: 240,
        description: "A realistic estimate, in months, of how long it would typically take this specific candidate (given their background) to reach this role.",
      },
      timelineRationale: {
        type: "string",
        description: "1-2 sentences explaining the timeline estimate, referencing something specific about the candidate's current background — not a generic 'it depends' statement.",
      },
    },
    required: ["inferredJobDescription", "estimatedTimelineMonths", "timelineRationale"],
  },
};

// Fallback for when someone names a target role (e.g. "CHRO") without a
// real job description to paste — infers typical responsibilities from
// general, well-known knowledge of the role rather than blocking the whole
// Gap Analysis on a missing paste. Explicitly not a fabricated citation to a
// specific real job posting or company — general role-knowledge only.
export async function inferRoleContext(targetRole: string, cvText: string): Promise<RoleContext> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: `You are helping someone who named a target career role but doesn't have a real job description to paste. Infer what that role typically involves, grounded in well-established, general knowledge of the role and seniority level — do not invent a fake specific job posting, company, or salary. Then estimate a realistic timeline for this specific candidate to reach it, based on what their background actually shows.`,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_role_context" },
    messages: [
      {
        role: "user",
        content: `TARGET ROLE: ${targetRole}\n\nCANDIDATE'S CURRENT BACKGROUND:\n${cvText}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }

  const result = toolUse.input as RoleContext;
  return {
    inferredJobDescription: result.inferredJobDescription,
    estimatedTimelineMonths: Math.max(3, Math.min(240, Math.round(result.estimatedTimelineMonths))),
    timelineRationale: result.timelineRationale,
  };
}
