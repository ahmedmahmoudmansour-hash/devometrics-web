import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
export async function breakdownIntoSteps(title: string, context?: string): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system:
      "Break the given goal into 3-6 small, concrete, actionable steps someone could each realistically do in under 30 minutes. No vague steps like 'work on it' — each must be a specific, doable action.",
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_task_breakdown" },
    messages: [{ role: "user", content: `Goal: ${title}${context?.trim() ? `\nContext: ${context.trim()}` : ""}` }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }
  const { steps } = toolUse.input as { steps: string[] };
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Model returned no steps");
  }
  return steps;
}
