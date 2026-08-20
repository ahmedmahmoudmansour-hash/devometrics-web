import { callOpenRouterJson } from "@/lib/ai/openrouter";
import type { Locale } from "@/lib/i18n/request";

export type TaskBreakdownResult = { steps: string[]; model: string; inputTokens: number; outputTokens: number };

const RECORD_TOOL = {
  name: "record_task_breakdown",
  description: "Record small, concrete steps that build toward a goal.",
  input_schema: {
    type: "object" as const,
    properties: {
      steps: {
        type: "array" as const,
        minItems: 3,
        maxItems: 6,
        items: { type: "string" },
      },
    },
    required: ["steps"],
  },
};

// Server-side only, unlike Orbit's client-side Groq call with
// dangerouslyAllowBrowser — the API key never reaches the browser here.
// GPT-5.4 Mini via OpenRouter — highest-frequency of the drafting-shaped
// call sites (any individual user, on demand, per milestone/task), trivial
// output shape, same routing rationale as the rest of this batch.
export async function breakdownIntoSteps(title: string, context?: string, locale: Locale = "en"): Promise<TaskBreakdownResult> {
  const { data, model, inputTokens, outputTokens } = await callOpenRouterJson<{ steps: string[] }>({
    model: "openai/gpt-5.4-mini",
    maxTokens: 400,
    system:
      `LANGUAGE: Write every step in ${locale === "ar" ? "Modern Standard Arabic (Fusha)" : "English"}, regardless of what language the goal/context below happen to be written in.\n\n` +
      "Break the given goal into 3-6 small, concrete, actionable steps someone could each realistically do in under 30 minutes. No vague steps like 'work on it' — each must be a specific, doable action.",
    user: `Goal: ${title}${context?.trim() ? `\nContext: ${context.trim()}` : ""}`,
    jsonSchema: { name: "record_task_breakdown", schema: RECORD_TOOL.input_schema },
  });

  const { steps } = data;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Model returned no steps");
  }
  return { steps, model, inputTokens, outputTokens };
}
