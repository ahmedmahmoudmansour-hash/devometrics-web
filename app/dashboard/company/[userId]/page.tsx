import Link from "next/link";
import { redirect } from "next/navigation";
import { buildEmployeeDetail } from "@/lib/organizations/aggregate";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import AssignTaskForm from "@/components/dashboard/AssignTaskForm";
import AssignAssessmentForm from "@/components/dashboard/AssignAssessmentForm";
import EmployeeReportExportBar from "@/components/dashboard/EmployeeReportExportBar";
import GenerateAssessmentSummaryButton from "@/components/dashboard/GenerateAssessmentSummaryButton";
import Avatar from "@/components/Avatar";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import { HBarChart, NineBoxGrid, NineBoxLegend } from "@/components/dashboard/charts";
import { levelText } from "@/lib/ui/levelColor";
import { ENGLISH_PROFICIENCY_SLUG, cefrLevelFromScore } from "@/lib/assessments/englishProficiency";

const LEADERSHIP_DIMS = ["Leadership", "Strategic Thinking", "People Management"] as const;

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 24,
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await buildEmployeeDetail(userId);
  if (!data.isAuthorized || !data.profile) redirect("/dashboard/company");

  const {
    profile,
    plans,
    gapAnalysis,
    assessmentResults,
    resumeScore,
    assignedAssessments,
    orgDimensionAverages,
    orgCareerHealthScore,
    assessmentSummary,
    assessmentSummaryGeneratedAt,
  } = data;
  const dimensionLevels = gapAnalysis
    ? Object.fromEntries(gapAnalysis.competencies.map((c) => [c.dimension, c.currentLevel]))
    : {};

  // Same axes as the org-wide Analytics 9-box, computed for this one
  // person — lets the report show where they sit in the exact grid an
  // admin already understands, not a report-specific metric.
  const dimensionValues = Object.values(dimensionLevels) as number[];
  const leadershipValues = LEADERSHIP_DIMS.map((d) => dimensionLevels[d]).filter(
    (v): v is number => v !== undefined
  );
  const nineBoxPoint =
    dimensionValues.length > 0 && leadershipValues.length > 0
      ? {
          name: profile.name,
          x: dimensionValues.reduce((a, b) => a + b, 0) / dimensionValues.length,
          y: leadershipValues.reduce((a, b) => a + b, 0) / leadershipValues.length,
        }
      : null;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="no-print">
          <Link href="/dashboard/company/employees" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to employees
          </Link>
        </div>

        <div style={{ marginTop: 12, marginBottom: 20 }}>
          <EmployeeReportExportBar />
        </div>

        <div className="print-plan" style={{ ...card, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span
            className="print-accent"
            style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}
          >
            Devometrics
          </span>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Employee Development Report · Confidential
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={44} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{profile.name}</h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                {[profile.title, profile.email].filter(Boolean).join(" · ")}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          {gapAnalysis && (
            <div style={{ textAlign: "right" }}>
              <span className="mono print-accent" style={{ fontSize: 30, fontWeight: 800, color: levelText(gapAnalysis.careerHealthScore) }}>
                {gapAnalysis.careerHealthScore}
              </span>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Career Health Score</p>
              {orgCareerHealthScore !== null && (
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {gapAnalysis.careerHealthScore > orgCareerHealthScore
                    ? `+${gapAnalysis.careerHealthScore - orgCareerHealthScore} vs team avg (${orgCareerHealthScore})`
                    : gapAnalysis.careerHealthScore < orgCareerHealthScore
                      ? `${gapAnalysis.careerHealthScore - orgCareerHealthScore} vs team avg (${orgCareerHealthScore})`
                      : `= team avg (${orgCareerHealthScore})`}
                </p>
              )}
            </div>
          )}
        </div>

        {assessmentSummary && (
          <div style={{ ...card, marginBottom: 20, borderLeft: "3px solid var(--teal)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 10 }}>
              Assessment Summary
            </p>
            <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.7 }}>{assessmentSummary.overallSummary}</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
              {assessmentSummary.keyStrengths.length > 0 && (
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 4 }}>
                    Key strengths
                  </p>
                  {assessmentSummary.keyStrengths.map((s) => (
                    <p key={s} style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>+ {s}</p>
                  ))}
                </div>
              )}
              {assessmentSummary.developmentPriorities.length > 0 && (
                <div>
                  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 4 }}>
                    Development priorities
                  </p>
                  {assessmentSummary.developmentPriorities.map((s) => (
                    <p key={s} style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>− {s}</p>
                  ))}
                </div>
              )}
            </div>

            {assessmentSummary.standingNote && (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <strong style={{ color: "var(--text)" }}>Where they stand: </strong>
                {assessmentSummary.standingNote}
              </p>
            )}

            {assessmentSummaryGeneratedAt && (
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10 }}>
                Written {new Date(assessmentSummaryGeneratedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        )}

        {!gapAnalysis && assessmentResults.length === 0 && resumeScore === null ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {profile.name} hasn&apos;t run a Gap Analysis, taken an assessment, or analyzed a resume
            yet — there&apos;s no measured data to report on. This isn&apos;t a reflection of them;
            it just means these tools haven&apos;t been used yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
            {gapAnalysis && (
              <div style={card}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                  Competency breakdown
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                  From their most recent Gap Analysis, scored against &quot;{gapAnalysis.targetRole}&quot; on{" "}
                  {new Date(gapAnalysis.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
                </p>
                <HBarChart
                  data={COMPETENCY_DIMENSIONS.filter((d) => dimensionLevels[d] !== undefined).map((d) => ({
                    label: d,
                    value: dimensionLevels[d] as number,
                    color: levelText(dimensionLevels[d] as number),
                    benchmark: orgDimensionAverages[d],
                  }))}
                  maxValue={100}
                  benchmarkLabel="marks the team average for that competency"
                />
                <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
                  <CapabilityPyramid dimensionLevels={dimensionLevels} compact />
                </div>
              </div>
            )}

            {nineBoxPoint && (
              <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", alignSelf: "flex-start", marginBottom: 4 }}>
                  Talent grid position
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, alignSelf: "flex-start" }}>
                  Where {profile.name.split(" ")[0]} sits on the same capability-vs-growth grid used
                  org-wide — horizontal is overall measured capability, vertical is leadership growth
                  signal (Leadership, Strategic Thinking, People Management).
                </p>
                <NineBoxGrid points={[nineBoxPoint]} xLabel="Measured capability" yLabel="Leadership growth signal" size={300} />
                <div style={{ alignSelf: "flex-start", width: "100%" }}>
                  <NineBoxLegend forceOpen />
                </div>
              </div>
            )}

            {(assessmentResults.length > 0 || resumeScore !== null) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                {resumeScore !== null && (
                  <div style={card}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                      Resume Intelligence
                    </p>
                    <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: levelText(resumeScore) }}>
                      {resumeScore}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/100</span>
                  </div>
                )}
                {assessmentResults.length > 0 && (
                  <div style={card}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                      Assessments ({assessmentResults.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {assessmentResults.slice(0, 6).map((a) => (
                        <div key={a.slug} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                          <span style={{ color: "var(--text)" }}>{a.name}</span>
                          {a.slug === ENGLISH_PROFICIENCY_SLUG ? (
                            <span className="mono" style={{ color: levelText(a.score), fontWeight: 700 }}>
                              {cefrLevelFromScore(a.score)} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>({a.score})</span>
                            </span>
                          ) : (
                            <span className="mono" style={{ color: levelText(a.score), fontWeight: 700 }}>{a.score}</span>
                          )}
                        </div>
                      ))}
                      {assessmentResults.length > 6 && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          + {assessmentResults.length - 6} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Development plans</h2>
          {plans.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              No development plans yet — assigning a task above will create one.
            </p>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{plan.title}</h3>
                {plan.milestones.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No tasks yet.</p>
                ) : (
                  plan.milestones
                    .sort((a, b) => a.position - b.position)
                    .map((m) => (
                      <div key={m.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <span
                            style={{
                              fontSize: 13,
                              color: m.completed ? "var(--text-muted)" : "var(--text)",
                              textDecoration: m.completed ? "line-through" : "none",
                            }}
                          >
                            {m.title}
                          </span>
                          {m.assigned_by && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--teal)",
                                background: "rgba(0,201,167,0.1)",
                                border: "1px solid rgba(0,201,167,0.3)",
                                borderRadius: 999,
                                padding: "3px 10px",
                                whiteSpace: "nowrap",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              Assigned by you
                            </span>
                          )}
                        </div>
                        {m.description && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                            {m.description}
                          </p>
                        )}
                      </div>
                    ))
                )}
              </div>
            ))
          )}
        </div>

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 32, textAlign: "center" }}>
          AI-assisted development report generated by Devometrics — a decision-support input, not a
          certified psychometric evaluation or a guarantee of any career outcome.
        </p>
        </div>

        {/* The block above is the clean, print-optimized report snapshot (used
            by the Download PDF button). This is the live management view —
            assign tasks and assessments — kept separate and marked no-print
            so it never shows up in the export. */}
        <div id="assign-task" className="no-print" style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 20 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Manage this employee
          </p>
          <GenerateAssessmentSummaryButton
            employeeUserId={userId}
            hasSummary={!!assessmentSummary}
            pendingAssignments={assignedAssessments.filter((a) => !a.completed).map((a) => a.name)}
          />
          <AssignTaskForm employeeUserId={userId} plans={plans.map((p) => ({ id: p.id, title: p.title }))} />
          <AssignAssessmentForm employeeUserId={userId} assigned={assignedAssessments} />
        </div>
      </div>
    </div>
  );
}
