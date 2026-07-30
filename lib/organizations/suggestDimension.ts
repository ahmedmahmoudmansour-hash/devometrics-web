import { callOpenRouterJson } from "@/lib/ai/openrouter";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";

export type DimensionSuggestionResult = { dimension: CompetencyDimension | null; rationale: string; model: string; inputTokens: number; outputTokens: number };

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
// GPT-5.4 Mini via OpenRouter — low-frequency (once per custom competency
// an admin creates), included for consistency with the rest of this "AI
// suggest X" drafting batch rather than leaving one outlier on Sonnet.
export async function suggestCompetencyDimension(
  name: string,
  description?: string
): Promise<DimensionSuggestionResult> {
  const { data, model, inputTokens, outputTokens } = await callOpenRouterJson<{ dimension: CompetencyDimension | null; rationale: string }>({
    model: "openai/gpt-5.4-mini",
    maxTokens: 300,
    system: `Given a company's own custom competency name (and optional description), decide which single one of these fixed dimensions it best maps onto: ${COMPETENCY_DIMENSIONS.join(", ")}. If it's genuinely values-based or doesn't cleanly fit any of them (e.g. "Integrity" as a pure values statement), say so and return null rather than forcing a weak fit.`,
    user: `Competency: ${name}${description?.trim() ? `\nDescription: ${description.trim()}` : ""}`,
    jsonSchema: { name: "record_dimension_suggestion", schema: RECORD_TOOL.input_schema },
  });
  return { dimension: data.dimension, rationale: data.rationale, model, inputTokens, outputTokens };
}
