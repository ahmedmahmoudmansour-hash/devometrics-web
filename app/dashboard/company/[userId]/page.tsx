import Link from "next/link";
import { redirect } from "next/navigation";
import { buildEmployeeDetail } from "@/lib/organizations/aggregate";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import AssignTaskForm from "@/components/dashboard/AssignTaskForm";
import AssignAssessmentForm from "@/components/dashboard/AssignAssessmentForm";
import Avatar from "@/components/Avatar";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import { HBarChart } from "@/components/dashboard/charts";
import { levelText } from "@/lib/ui/levelColor";

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

  const { profile, plans, gapAnalysis, assessmentResults, resumeScore, assignedAssessments } = data;
  const dimensionLevels = gapAnalysis
    ? Object.fromEntries(gapAnalysis.competencies.map((c) => [c.dimension, c.currentLevel]))
    : {};

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/dashboard/company/employees" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
          ← Back to employees
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginTop: 12, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={44} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{profile.name}</h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                {[profile.title, profile.email].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          {gapAnalysis && (
            <div style={{ textAlign: "right" }}>
              <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: levelText(gapAnalysis.careerHealthScore) }}>
                {gapAnalysis.careerHealthScore}
              </span>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Career Health Score</p>
            </div>
          )}
        </div>

        {!gapAnalysis && assessmentResults.length === 0 && resumeScore === null ? (
          <div style={{ ...card, marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {profile.name} hasn&apos;t run a Gap Analysis, taken an assessment, or analyzed a resume
              yet — there&apos;s no measured data to report on. This isn&apos;t a reflection of them;
              it just means these tools haven&apos;t been used yet.
            </p>
          </div>
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
                  }))}
                  maxValue={100}
                />
                <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
                  <CapabilityPyramid dimensionLevels={dimensionLevels} compact />
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
                          <span className="mono" style={{ color: levelText(a.score), fontWeight: 700 }}>{a.score}</span>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AssignTaskForm employeeUserId={userId} plans={plans.map((p) => ({ id: p.id, title: p.title }))} />
          <AssignAssessmentForm employeeUserId={userId} assigned={assignedAssessments} />
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 20 }}>
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
      </div>
    </div>
  );
}
