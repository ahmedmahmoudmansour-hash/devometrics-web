import { createClient } from "@/lib/supabase/server";
import { ENGLISH_PROFICIENCY_SLUG, cefrLevelFromScore } from "@/lib/assessments/englishProficiency";
import { COGNITIVE_ABILITY_SLUG, cognitiveBandFromScore } from "@/lib/assessments/cognitiveAbility";
import { BIG_FIVE_TRAITS, bigFiveInterpretation } from "@/lib/personality/bigFive";
import { resolveAssessmentName } from "@/lib/organizations/aggregate";
import type { Profile, BigFiveProfile } from "@/lib/supabase/types";

// Single source of "everything known about this person" fed into every
// competency-scoring AI call, regardless of which page triggered it — the
// full Gap Analysis form, the dashboard quick-plan shortcut, or Assessments.
// Priority: whatever they just typed/pasted this time, plus their most
// recent full Gap Analysis CV text, plus their structured Career Profile
// (job history/skills/qualifications/aspirations), plus every completed
// assessment (Assessment Center, English Proficiency, Cognitive Reasoning),
// plus their working-style context (Big Five, only if they've opted to
// share it — interpretation text only, never raw trait scores). Combined,
// not one-or-the-other, since each can carry details the others don't.
export async function buildBackgroundContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  manualText: string
): Promise<string> {
  const parts: string[] = [];
  if (manualText.trim()) parts.push(manualText.trim());

  const { data: latestAnalysis } = await supabase
    .from("gap_analyses")
    .select("cv_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ cv_text: string }>();
  if (latestAnalysis?.cv_text?.trim() && latestAnalysis.cv_text.trim() !== manualText.trim()) {
    parts.push(latestAnalysis.cv_text.trim());
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("job_history, skills, qualifications, career_aspirations")
    .eq("id", userId)
    .maybeSingle<Pick<Profile, "job_history" | "skills" | "qualifications" | "career_aspirations">>();

  if (profile?.job_history?.length) {
    parts.push(
      "Job history:\n" +
        profile.job_history.map((j) => `${j.title} at ${j.company} (${j.duration}): ${j.description}`).join("\n")
    );
  }
  if (profile?.skills?.length) parts.push("Skills: " + profile.skills.join(", "));
  if (profile?.qualifications?.length) {
    parts.push(
      "Qualifications:\n" +
        profile.qualifications.map((q) => `${q.credential}, ${q.institution} (${q.year})`).join("\n")
    );
  }
  if (profile?.career_aspirations?.trim()) parts.push("Career aspirations: " + profile.career_aspirations.trim());

  // Isolated, defensive queries — a missing table/column (older database,
  // migration not yet run) degrades to "this signal just isn't included"
  // rather than breaking analysis/plan generation entirely.
  const { data: assessmentResults } = await supabase
    .from("assessment_results")
    .select("assessment_slug, score, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .returns<{ assessment_slug: string; score: number; completed_at: string }[]>();
  if (assessmentResults?.length) {
    const latestBySlug = new Map<string, { assessment_slug: string; score: number }>();
    for (const r of assessmentResults) if (!latestBySlug.has(r.assessment_slug)) latestBySlug.set(r.assessment_slug, r);
    const lines = [...latestBySlug.values()].map((r) => {
      if (r.assessment_slug === ENGLISH_PROFICIENCY_SLUG) {
        return `English Proficiency: CEFR ${cefrLevelFromScore(r.score)}`;
      }
      if (r.assessment_slug === COGNITIVE_ABILITY_SLUG) {
        return `Cognitive Reasoning: ${cognitiveBandFromScore(r.score)} (self-development signal only)`;
      }
      return `${resolveAssessmentName(r.assessment_slug)}: ${r.score}/100`;
    });
    parts.push("Completed assessments:\n" + lines.join("\n"));
  }

  const { data: bigFive } = await supabase
    .from("big_five_profiles")
    .select("scores")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<BigFiveProfile, "scores">>();
  if (bigFive?.scores) {
    const lines = BIG_FIVE_TRAITS.map((trait) => bigFiveInterpretation(trait, bigFive.scores[trait]));
    parts.push(
      "Working style (self-reported — use only to shape how milestones are framed, e.g. preferred learning format or pacing, never as a strength/weakness judgment):\n" +
        lines.join("\n")
    );
  }

  return parts.length > 0 ? parts.join("\n\n") : "No background details provided yet.";
}
