"use server";

import { COGNITIVE_QUESTIONS, COGNITIVE_ABILITY_SLUG } from "@/lib/assessments/cognitiveAbility";
import { saveAssessmentResult } from "@/app/dashboard/assessments/actions";

type SubmitResult =
  | { success: false; error: string }
  | { success: true; score: number; answers: number[] };

export async function submitCognitiveAbility(selections: Record<string, number>): Promise<SubmitResult> {
  const missing = COGNITIVE_QUESTIONS.some((q) => selections[q.id] === undefined);
  if (missing) return { success: false, error: "Please answer every question before submitting." };

  const answers = COGNITIVE_QUESTIONS.map((q) => (selections[q.id] === q.correctIndex ? 1 : 0));
  const correct = answers.reduce((a: number, b) => a + b, 0);
  const score = Math.round((correct / COGNITIVE_QUESTIONS.length) * 100);

  const result = await saveAssessmentResult(COGNITIVE_ABILITY_SLUG, score, answers);
  if (result?.error) return { success: false, error: result.error };

  return { success: true, score, answers };
}
