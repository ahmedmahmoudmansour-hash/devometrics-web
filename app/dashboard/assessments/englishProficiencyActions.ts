"use server";

import { ENGLISH_PROFICIENCY_QUESTIONS, ENGLISH_PROFICIENCY_SLUG } from "@/lib/assessments/englishProficiency";
import { saveAssessmentResult } from "@/app/dashboard/assessments/actions";

// selections is questionId -> chosen option index. Scored entirely
// server-side against ENGLISH_PROFICIENCY_QUESTIONS' correctIndex — the
// client never sees which option is correct until after submitting, and
// a tampered client-side score could never be trusted anyway.
type SubmitResult =
  | { success: false; error: string }
  | { success: true; score: number; answers: number[] };

export async function submitEnglishProficiency(selections: Record<string, number>): Promise<SubmitResult> {
  const missing = ENGLISH_PROFICIENCY_QUESTIONS.some((q) => selections[q.id] === undefined);
  if (missing) return { success: false, error: "Please answer every question before submitting." };

  const answers = ENGLISH_PROFICIENCY_QUESTIONS.map((q) => (selections[q.id] === q.correctIndex ? 1 : 0));
  const correct = answers.reduce((a: number, b) => a + b, 0);
  const score = Math.round((correct / ENGLISH_PROFICIENCY_QUESTIONS.length) * 100);

  const result = await saveAssessmentResult(ENGLISH_PROFICIENCY_SLUG, score, answers);
  if (result?.error) return { success: false, error: result.error };

  return { success: true, score, answers };
}
