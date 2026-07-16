import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENTS, LEVEL_SECTIONS, type LevelSection } from "@/lib/assessments/catalog";
import { CASE_STUDY_EXERCISES } from "@/lib/assessments/caseStudyExercises";
import { ENGLISH_PROFICIENCY_SLUG, cefrLevelFromScore } from "@/lib/assessments/englishProficiency";
import { COGNITIVE_ABILITY_SLUG, cognitiveBandFromScore } from "@/lib/assessments/cognitiveAbility";
import { rankByImpact } from "@/lib/gap-analysis/dimensions";
import AssessmentPlanGenerator from "@/components/dashboard/AssessmentPlanGenerator";
import type { AssessmentResult, CaseStudyExerciseAttempt, GapAnalysis, Profile } from "@/lib/supabase/types";

const SECTION_ICON: Record<LevelSection, string> = {
  Foundational: "●",
  Professional: "◆",
  Leadership: "▲",
  Executive: "★",
};

function sectionForCareerStage(careerStage: string | null): LevelSection | null {
  if (!careerStage) return null;
  if (["Student", "Job seeker", "Early-career professional"].includes(careerStage)) return "Foundational";
  if (["Professional", "Career changer", "Entrepreneur / Freelancer"].includes(careerStage)) return "Professional";
  if (careerStage === "Manager") return "Leadership";
  if (careerStage === "Executive") return "Executive";
  return null;
}

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: results } = await supabase
    .from("assessment_results")
    .select("*")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .returns<AssessmentResult[]>();

  const { data: profile } = await supabase
    .from("profiles")
    .select("career_stage, learning_preferences")
    .eq("id", user.id)
    .single<Pick<Profile, "career_stage" | "learning_preferences">>();

  const { data: latestAnalysis } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GapAnalysis>();

  const { data: exerciseAttempts } = await supabase
    .from("case_study_exercise_attempts")
    .select("*")
    .eq("user_id", user.id)
    .not("submitted_at", "is", null)
    .order("created_at", { ascending: false })
    .returns<CaseStudyExerciseAttempt[]>();

  // New table (migration 0058) — a query error before it's run just yields
  // null, so this degrades to "nothing assigned" rather than breaking the
  // page for everyone else.
  const { data: assignedRows } = await supabase
    .from("assigned_assessments")
    .select("assessment_slug")
    .eq("employee_user_id", user.id)
    .returns<{ assessment_slug: string }[]>();

  const latestBySlug = new Map<string, AssessmentResult>();
  for (const r of results ?? []) {
    if (!latestBySlug.has(r.assessment_slug)) latestBySlug.set(r.assessment_slug, r);
  }

  // English Proficiency and Cognitive Reasoning live outside ASSESSMENTS
  // (they're objective tests, not the self-report catalog) — without this,
  // someone assigned either would never see it in the "Assigned to you"
  // callout below, even though the admin-side assignment picker already
  // lets them be assigned.
  const pendingAssigned = (assignedRows ?? [])
    .map((r) =>
      r.assessment_slug === ENGLISH_PROFICIENCY_SLUG
        ? { slug: ENGLISH_PROFICIENCY_SLUG, name: "English Proficiency" }
        : r.assessment_slug === COGNITIVE_ABILITY_SLUG
        ? { slug: COGNITIVE_ABILITY_SLUG, name: "Cognitive Reasoning" }
        : ASSESSMENTS.find((a) => a.slug === r.assessment_slug)
    )
    .filter((a): a is { slug: string; name: string } => !!a && !latestBySlug.has(a.slug));

  const latestAttemptBySlug = new Map<string, CaseStudyExerciseAttempt>();
  for (const a of exerciseAttempts ?? []) {
    if (!latestAttemptBySlug.has(a.exercise_slug)) latestAttemptBySlug.set(a.exercise_slug, a);
  }

  // Goal-based: surface the exercise matching the user's highest-impact gap
  // from their most recent Gap Analysis, if they've run one.
  const topGapDimension = latestAnalysis ? rankByImpact(latestAnalysis.competencies)[0]?.dimension : null;
  const recommendedExerciseSlug = topGapDimension
    ? CASE_STUDY_EXERCISES.find((e) => e.dimension === topGapDimension)?.slug
    : null;

  const recommended = sectionForCareerStage(profile?.career_stage ?? null);
  const orderedSections = recommended
    ? [LEVEL_SECTIONS.find((s) => s.key === recommended)!, ...LEVEL_SECTIONS.filter((s) => s.key !== recommended)]
    : LEVEL_SECTIONS;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Assessment Center
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {ASSESSMENTS.length} assessments, organized by level, to help you understand your
            strengths and blind spots more clearly.
          </p>
        </div>

        {pendingAssigned.length > 0 && (
          <div style={{ background: "rgba(240,184,64,0.06)", border: "1px solid rgba(240,184,64,0.25)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f0b840", marginBottom: 10 }}>
              Assigned to you ({pendingAssigned.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingAssigned.map((a) => (
                <Link
                  key={a.slug}
                  href={`/dashboard/assessments/${a.slug}`}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, textDecoration: "none" }}
                >
                  <span style={{ color: "var(--text)" }}>{a.name}</span>
                  <span style={{ color: "#f0b840", fontWeight: 600 }}>Start →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <AssessmentPlanGenerator completedCount={latestBySlug.size} learningPreferences={profile?.learning_preferences ?? []} />

        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Language Proficiency
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            A real ability test — grammar, vocabulary, and reading comprehension with correct answers,
            leveled A1–C2. Unlike everything below, this isn&apos;t a self-rating.
          </p>
          <Link
            href={`/dashboard/assessments/${ENGLISH_PROFICIENCY_SLUG}`}
            style={{
              display: "block",
              maxWidth: 280,
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 20,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
              CEFR-style · 24 questions
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: 6 }}>
              English Proficiency
            </h3>
            {(() => {
              const result = latestBySlug.get(ENGLISH_PROFICIENCY_SLUG);
              return result ? (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>
                  Completed — {cefrLevelFromScore(result.score)}
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Not started</span>
              );
            })()}
          </Link>
        </div>

        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Cognitive Reasoning
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            A short numerical, verbal, and logical reasoning exercise with real correct answers — a
            self-development input, not a hiring or selection instrument.
          </p>
          <Link
            href={`/dashboard/assessments/${COGNITIVE_ABILITY_SLUG}`}
            style={{
              display: "block",
              maxWidth: 280,
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 20,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
              54 questions · 3 domains
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: 6 }}>
              Cognitive Reasoning
            </h3>
            {(() => {
              const result = latestBySlug.get(COGNITIVE_ABILITY_SLUG);
              return result ? (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>
                  Completed — {cognitiveBandFromScore(result.score)}
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Not started</span>
              );
            })()}
          </Link>
        </div>

        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Assessment Centre — Timed Case Studies
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            A deeper, timed exercise — a real business case, a written response, and a structured
            feedback report. Not a quick self-rating.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {CASE_STUDY_EXERCISES.map((ex) => {
              const attempt = latestAttemptBySlug.get(ex.slug);
              const isRecommended = ex.slug === recommendedExerciseSlug;
              return (
                <Link
                  key={ex.slug}
                  href={`/dashboard/assessments/exercise/${ex.slug}`}
                  style={{
                    display: "block",
                    background: "var(--navy-mid)",
                    border: isRecommended ? "1px solid rgba(0,201,167,0.4)" : "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 20,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
                      {ex.dimension} · {ex.level}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", whiteSpace: "nowrap" }}>
                      {ex.timeLimitMinutes} min
                    </span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: 6 }}>
                    {ex.title}
                  </h3>
                  {isRecommended && (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#0A0F1E",
                        background: "var(--teal)",
                        borderRadius: 100,
                        padding: "3px 10px",
                        marginBottom: 8,
                      }}
                    >
                      Matches your goal
                    </span>
                  )}
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 14 }}>
                    {ex.context.slice(0, 110)}…
                  </p>
                  {attempt ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>
                      Completed — {attempt.score}/100 →
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Not started</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {orderedSections.map((section) => {
          const items = ASSESSMENTS.filter((a) => a.level === section.key);
          if (items.length === 0) return null;
          const isRecommended = section.key === recommended;
          const completedItems = items.filter((a) => latestBySlug.has(a.slug));
          const sectionAverage = completedItems.length
            ? Math.round(
                completedItems.reduce((sum, a) => sum + (latestBySlug.get(a.slug)?.score ?? 0), 0) /
                  completedItems.length
              )
            : null;
          const sectionProgressPercent = Math.round((completedItems.length / items.length) * 100);
          return (
            <div key={section.key} style={{ marginBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: "rgba(0,201,167,0.12)",
                    color: "var(--teal)",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {SECTION_ICON[section.key]}
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{section.label}</h2>
                {isRecommended && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#0A0F1E",
                      background: "var(--teal)",
                      borderRadius: 100,
                      padding: "3px 10px",
                    }}
                  >
                    Recommended for you
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10, marginLeft: 36 }}>
                {section.blurb}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginLeft: 36 }}>
                <div style={{ flex: 1, maxWidth: 200, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${sectionProgressPercent}%`,
                      height: "100%",
                      background: "var(--teal)",
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {completedItems.length}/{items.length} completed
                  {sectionAverage !== null && ` · avg ${sectionAverage}/100`}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {items.map((a) => {
                  const result = latestBySlug.get(a.slug);
                  return (
                    <Link
                      key={a.slug}
                      href={`/dashboard/assessments/${a.slug}`}
                      style={{
                        display: "block",
                        background: "var(--navy-mid)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        padding: 20,
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
                        {a.category}
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: 6 }}>
                        {a.name}
                      </h3>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 14 }}>
                        {a.description}
                      </p>
                      {result ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>
                          Completed — {result.score}/100
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Not started</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
