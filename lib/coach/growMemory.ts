import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type GrowState = { goal: string; reality: string; options: string; will: string };

const UPDATE_TOOL = {
  name: "update_grow_memory",
  description:
    "Update the running GROW-model (Goal, Reality, Options, Will) coaching memory based on the latest exchange. Each field is a short, current-state summary (2-4 sentences), not a transcript.",
  input_schema: {
    type: "object" as const,
    properties: {
      goal: {
        type: "string",
        description: "The user's current, most specific career goal established so far. Empty string if none established yet.",
      },
      reality: {
        type: "string",
        description: "Current honest state relative to the goal — skills, constraints, blockers. Empty string if not yet discussed.",
      },
      options: {
        type: "string",
        description: "Options/approaches discussed so far for closing the gap. Empty string if none discussed.",
      },
      will: {
        type: "string",
        description: "Specific commitments the user has made — what they said they'd do, and by when. Empty string if none made.",
      },
    },
    required: ["goal", "reality", "options", "will"],
  },
};

// Keeps a running GROW-model summary of the coaching relationship across
// every past conversation, not just the current session's message history —
// so a new conversation started tomorrow can open with "last time your goal
// was X and you committed to Y" instead of starting cold. Deliberately a
// short current-state summary per field, not an append-only log: each call
// is told to carry forward anything still true and only change what this
// exchange actually updated.
export async function updateGrowMemory(
  priorMemory: GrowState | null,
  latestUserMessage: string,
  latestAssistantReply: string
): Promise<GrowState> {
  const priorContext = priorMemory
    ? `Goal: ${priorMemory.goal || "(none yet)"}\nReality: ${priorMemory.reality || "(none yet)"}\nOptions: ${priorMemory.options || "(none yet)"}\nWill: ${priorMemory.will || "(none yet)"}`
    : "No prior GROW memory — this is the first exchange.";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system:
      "You maintain a running GROW-model (Goal, Reality, Options, Will) summary of an ongoing career-coaching relationship. Given the prior summary and the latest exchange, call update_grow_memory with the new current state. Carry forward anything still true; do not discard established context just because it wasn't repeated this turn. Only change a field if this exchange actually moved it forward.",
    tool_choice: { type: "tool", name: "update_grow_memory" },
    tools: [UPDATE_TOOL],
    messages: [
      {
        role: "user",
        content: `PRIOR GROW MEMORY:\n${priorContext}\n\nLATEST EXCHANGE:\nUser: ${latestUserMessage}\nCoach: ${latestAssistantReply}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }
  return toolUse.input as GrowState;
}
