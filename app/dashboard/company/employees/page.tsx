import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import Avatar from "@/components/Avatar";
import EditEmployeeButton from "@/components/dashboard/EditEmployeeButton";
import { levelBg } from "@/lib/ui/levelColor";

export default async function CompanyEmployeesPage() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const cellStyle: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 13,
    borderBottom: "1px solid var(--border)",
    color: "var(--text)",
  };
  const headStyle: React.CSSProperties = {
    ...cellStyle,
    color: "var(--text-muted)",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)",
  };

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
              ← Back to progress
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
              {data.organizationName}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {data.rows.length} team member{data.rows.length === 1 ? "" : "s"}
            </p>
          </div>
          {data.rows.length > 0 && (
            <a
              href="/api/company/export/xlsx"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Export to Excel
            </a>
          )}
          {data.companyCareerHealthScore !== null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "var(--teal)" }}>
                  {data.companyCareerHealthScore}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Company Career Health Score</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Averaged across everyone who&apos;s run a Gap Analysis.
              </p>
            </div>
          )}
        </div>

        <CompanyNavTabs active="employees" />

        {data.rows.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              No team members yet. Share your invite code from the{" "}
              <Link href="/dashboard/company" style={{ color: "var(--teal)" }}>
                Profile
              </Link>{" "}
              tab — anyone who signs up with a Company account and enters it will join your workspace.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Workforce skill inventory */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                Workforce skill inventory
              </h2>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...headStyle, textAlign: "left" }}>Name</th>
                        <th style={{ ...headStyle, textAlign: "left" }}>Title</th>
                        <th style={{ ...headStyle, textAlign: "left" }}>Department</th>
                        <th style={{ ...headStyle, textAlign: "left" }}>Country</th>
                        <th style={{ ...headStyle, textAlign: "left" }}>Email</th>
                        <th style={{ ...headStyle, textAlign: "right" }}>Career Health Score</th>
                        <th style={{ ...headStyle, textAlign: "right" }}>Assessments</th>
                        <th style={{ ...headStyle, textAlign: "right" }}>Plans</th>
                        <th style={{ ...headStyle, textAlign: "right" }}>Milestones</th>
                        <th style={{ ...headStyle, textAlign: "right" }} aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.userId}>
                          <td style={cellStyle}>
                            <Link
                              href={`/dashboard/company/${r.userId}`}
                              style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}
                            >
                              <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                              <span style={{ textDecoration: "underline", textDecorationColor: "var(--border)" }}>{r.name}</span>
                            </Link>
                          </td>
                          <td style={{ ...cellStyle, color: r.title ? "var(--text)" : "var(--text-muted)" }}>
                            {r.title ?? "—"}
                          </td>
                          <td style={{ ...cellStyle, color: r.department ? "var(--text)" : "var(--text-muted)" }}>
                            {r.department ?? "—"}
                          </td>
                          <td style={{ ...cellStyle, color: r.country ? "var(--text)" : "var(--text-muted)" }}>
                            {r.country ?? "—"}
                          </td>
                          <td style={cellStyle}>{r.email}</td>
                          <td style={{ ...cellStyle, textAlign: "right", color: "var(--teal)", fontWeight: 700 }}>
                            {r.careerHealthScore ?? "—"}
                          </td>
                          <td style={{ ...cellStyle, textAlign: "right" }}>{r.assessmentsCompleted}</td>
                          <td style={{ ...cellStyle, textAlign: "right" }}>{r.plans}</td>
                          <td style={{ ...cellStyle, textAlign: "right" }}>
                            {r.milestonesDone}/{r.milestonesTotal}
                          </td>
                          <td style={{ ...cellStyle, textAlign: "right" }}>
                            <EditEmployeeButton
                              memberId={r.memberId}
                              name={r.name}
                              initial={{
                                title: r.title,
                                department: r.department,
                                country: r.country,
                                managerName: r.managerName,
                                managerEmail: r.managerEmail,
                                businessUnit: r.businessUnit,
                                location: r.location,
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Capability pyramid, team average */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                Team capability pyramid
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                The same 8 dimensions from the heatmap below, grouped by tier and averaged
                across everyone who&apos;s run a Gap Analysis.
              </p>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, display: "flex", justifyContent: "center" }}>
                <CapabilityPyramid dimensionLevels={data.dimensionAverages} />
              </div>
            </div>

            {/* Talent heatmap */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                Talent heatmap
              </h2>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...headStyle, textAlign: "left" }}>Name</th>
                        {COMPETENCY_DIMENSIONS.map((d) => (
                          <th key={d} style={{ ...headStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.userId}>
                          <td style={cellStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                              {r.name}
                            </div>
                          </td>
                          {COMPETENCY_DIMENSIONS.map((d) => (
                            <td
                              key={d}
                              style={{ ...cellStyle, textAlign: "center", background: levelBg(r.dimensionLevels[d]) }}
                            >
                              {r.dimensionLevels[d] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...cellStyle, fontWeight: 700, color: "var(--text-muted)" }}>Team average</td>
                        {COMPETENCY_DIMENSIONS.map((d) => (
                          <td key={d} style={{ ...cellStyle, textAlign: "center", fontWeight: 700 }}>
                            {data.dimensionAverages[d] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                Blank cells mean that person hasn&apos;t run a Gap Analysis yet — not a zero score.
              </p>
            </div>

            {/* Leadership readiness signal */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                Leadership readiness signal
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
                A directional ranking by Leadership, Strategic Thinking, and People Management
                scores — not a formal succession plan. A real succession plan needs role
                criticality, org-chart, and readiness-timeline data this product doesn&apos;t capture
                yet; treat this as a starting conversation, not a decision.
              </p>
              {data.leadershipReadiness.length === 0 ? (
                <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    No one has run a Gap Analysis yet, so there&apos;s nothing to rank.
                  </p>
                </div>
              ) : (
                <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 8 }}>
                  {data.leadershipReadiness.map((r, i) => (
                    <div
                      key={r.userId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: i === data.leadershipReadiness.length - 1 ? "none" : "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                        {i + 1}. <Avatar name={r.name} avatarUrl={r.avatarUrl} size={22} /> {r.name}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--teal)", fontWeight: 700 }}>{r.score}/100</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
