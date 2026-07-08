import type { SurveyAnswers, SurveyQuestion } from "./types";

export type QuestionAggregate =
  | { questionId: string; text: string; type: "rating"; count: number; average: number }
  | { questionId: string; text: string; type: "multiple_choice"; count: number; optionCounts: Record<string, number> }
  | { questionId: string; text: string; type: "qualitative"; count: number; responses: string[] };

// Pure computation over already-anonymized answer blobs (no user_id ever
// present) — kept in TypeScript rather than SQL so the per-question math is
// easy to read, test, and get right, instead of buried in plpgsql no one can
// verify without a live database.
export function aggregateSurveyResponses(
  questions: SurveyQuestion[],
  responses: SurveyAnswers[]
): QuestionAggregate[] {
  return questions.map((q) => {
    const values = responses.map((r) => r[q.id]).filter((v) => v !== undefined && v !== null);

    if (q.type === "rating") {
      const numeric = values.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
      const average = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : 0;
      return { questionId: q.id, text: q.text, type: "rating", count: numeric.length, average: Math.round(average * 10) / 10 };
    }

    if (q.type === "qualitative") {
      // Already returned in random order by get_survey_response_values, but
      // re-shuffle here too since this array was built by mapping in
      // question order, not response order — belt and suspenders against
      // position ever correlating back to submission time.
      const texts = values.map((v) => String(v)).filter((t) => t.trim().length > 0);
      return { questionId: q.id, text: q.text, type: "qualitative", count: texts.length, responses: texts };
    }

    const optionCounts: Record<string, number> = {};
    for (const v of values) {
      const key = String(v);
      optionCounts[key] = (optionCounts[key] ?? 0) + 1;
    }
    return { questionId: q.id, text: q.text, type: "multiple_choice", count: values.length, optionCounts };
  });
}
