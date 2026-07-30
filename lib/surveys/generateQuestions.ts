import { callOpenRouterJson } from "@/lib/ai/openrouter";
import type { SurveyQuestion } from "./types";

export type SurveyQuestionsResult = { questions: SurveyQuestion[]; model: string; inputTokens: number; outputTokens: number };

const RECORD_TOOL = {
  name: "record_survey_questions",
  description: "Record a set of pulse-survey questions for the given theme.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array" as const,
        minItems: 5,
        maxItems: 8,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: 'Short slug id, e.g. "q1", "q2"' },
            text: { type: "string", description: "The question as employees will read it" },
            type: { type: "string", enum: ["rating", "multiple_choice", "qualitative"] },
            options: {
              type: "array" as const,
              items: { type: "string" },
              description: "3-5 answer options — required and only used when type is multiple_choice",
            },
          },
          required: ["id", "text", "type"],
        },
      },
    },
    required: ["questions"],
  },
};

// Mixes all three question types. Qualitative (free-text) answers are only
// ever shown to admins in randomized order once enough people have
// responded (see get_survey_response_values in migration 0041) — but even
// with that gate, open text can self-identify someone through its content
// alone (e.g. naming a specific shift or project). No software gate fixes
// that; it's a real, inherent limitation of open-text feedback, not a bug.
// GPT-5.4 Mini via OpenRouter — drafting-shaped question set an admin
// reviews and edits before publishing, same routing rationale as the other
// "AI suggest/generate" drafting features.
export async function generateSurveyQuestions(theme: string, focus?: string): Promise<SurveyQuestionsResult> {
  const { data, model, inputTokens, outputTokens } = await callOpenRouterJson<{ questions: SurveyQuestion[] }>({
    model: "openai/gpt-5.4-mini",
    maxTokens: 2048,
    system:
      'You are drafting an anonymous internal pulse survey for a company\'s HR team. Write 5-8 clear, neutral, non-leading questions on the given theme. Mix "rating" questions (1-5 agreement/satisfaction scale — do not include the scale in the text, just the statement), a couple of "multiple_choice" questions where a fixed set of options genuinely fits better than a scale, and 1-2 "qualitative" open-ended questions that invite specific, actionable feedback a rating can\'t capture. Avoid jargon, avoid double-barreled questions (asking two things at once), and avoid anything that could pressure a specific answer.',
    user: `Theme: ${theme}${focus?.trim() ? `\n\nSpecific focus requested by HR: ${focus.trim()}` : ""}`,
    jsonSchema: { name: "record_survey_questions", schema: RECORD_TOOL.input_schema },
  });

  const { questions } = data;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Model returned no questions");
  }
  return { questions, model, inputTokens, outputTokens };
}
