import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RECORD_TOOL = {
  name: "record_case_study_score",
  description: "Score a free-text response to a workplace case study scenario against a named competency.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "0-100, how effectively the response demonstrates the competency in the scenario described — judged on the reasoning and specificity shown, not writing quality",
      },
      insight: {
        type: "string",
        description: "1-2 sentences of specific, grounded observation about what the response reveals about this person's thinking or behavior — reference something actually in their answer, not generic praise or criticism",
      },
    },
    required: ["score", "insight"],
  },
};

export async function scoreOpenCaseStudy({
  assessmentName,
  scenario,
  prompt,
  responseText,
}: {
  assessmentName: string;
  scenario: string;
  prompt: string;
  responseText: string;
}): Promise<{ score: number; insight: string }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: `You are scoring one open-ended case study response as part of the Devometrics Assessment Center, for the "${assessmentName}" competency. This is a heuristic judgment call, not a validated psychometric instrument — score based on the concreteness, reasoning, and self-awareness actually shown in the response, not on writing quality or length. A short, specific, honest answer should score as well as a longer polished one. Ground the insight in something specific the person actually wrote — never invent detail they didn't provide.`,
    tools: [RECORD_TOOL],
    tool_choice: { type: "tool", name: "record_case_study_score" },
    messages: [
      {
        role: "user",
        content: `SCENARIO: ${scenario}\n\nPROMPT: ${prompt}\n\nRESPONSE: ${responseText}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured output");
  }

  const result = toolUse.input as { score: number; insight: string };
  return {
    score: Math.max(0, Math.min(100, Math.round(result.score))),
    insight: result.insight,
  };
}
