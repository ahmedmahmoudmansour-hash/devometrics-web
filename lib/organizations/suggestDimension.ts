import Anthropic from "@anthropic-ai/sdk";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECORD_TOOL = {
  name: "record_dimension_suggestion",
  description: "Record which of the fixed dimensions a custom competency best maps onto, or none.",
  input_schema: {
    type: "object" as const,
    properties: {
      dimension: {
        type: ["string", "null"],
        enum: [...COMPETENCY_DIMENSIONS, null],
        description: "The single best-fit dimension, or null if none genuinely fits",
      },
      rationale: { type: "string", description: "One short sentence explaining the mapping (or why none fits)" },
    },
    required: ["dimension", "rationale"],
  },
};

// HR admins can map a custom competency themselves, or ask AI to suggest —
// either way it's a suggestion the admin can override or leave unmapped,
// never an automatic/silent assignment.
export async function suggestCompetencyDimension(
  name: string,
  description?: string
): Promise<{ dimension: CompetencyDimension | null; rationale: string }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system: `Given a company's own custom competency name (and optional description), decide which single one of these fixed dimensions it best maps onto: ${COMPETENCY_DIMENSIONS.join(", ")}. If it's genuinely values-based or doesn't cleanly fit any of them (e.g. "Integrity" as a pure values statement), say so and return null rather than forcing a weak fit.`,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_dimension_suggestion" },
    messages: [{ role: "user", content: `Competency: ${name}${description?.trim() ? `\nDescription: ${description.trim()}` : ""}` }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a suggestion");
  }
  return toolUse.input as { dimension: CompetencyDimension | null; rationale: string };
}
