import Link from "next/link";
import { redirect } from "next/navigation";
import { buildPilotRows } from "@/lib/admin/aggregate";
import { buildAdminOrganizations } from "@/lib/admin/organizations";
import AdminOrganizationsTable from "@/components/dashboard/AdminOrganizationsTable";

export default async function AdminPage() {
  const [{ isAdmin, rows }, { rows: orgRows }] = await Promise.all([buildPilotRows(), buildAdminOrganizations()]);
  if (!isAdmin) redirect("/dashboard");

  const withScore = rows.filter((r) => r.careerHealthScore !== null);
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((s, r) => s + (r.careerHealthScore ?? 0), 0) / withScore.length)
    : null;

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
              Pilot admin view
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {rows.length} participant{rows.length === 1 ? "" : "s"}
              {avgScore !== null ? ` · avg Career Health Score ${avgScore}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href="/dashboard/admin/inquiries"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              Contact inquiries
            </Link>
            <a
              href="/api/admin/export/xlsx"
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Export to Excel
            </a>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Scoped to this pilot cohort only — not a multi-tenant company workspace. Everyone here shares
          one admin view; per-company data isolation is a separate, larger build for after the pilot.
        </p>

        <AdminOrganizationsTable initial={orgRows} />

        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...headStyle, textAlign: "left" }}>Name</th>
                  <th style={{ ...headStyle, textAlign: "left" }}>Email</th>
                  <th style={{ ...headStyle, textAlign: "left" }}>Organization</th>
                  <th style={{ ...headStyle, textAlign: "right" }}>Career Health Score</th>
                  <th style={{ ...headStyle, textAlign: "right" }}>Assessments</th>
                  <th style={{ ...headStyle, textAlign: "right" }}>Plans</th>
                  <th style={{ ...headStyle, textAlign: "right" }}>Milestones</th>
                  <th style={{ ...headStyle, textAlign: "right" }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td style={cellStyle} colSpan={8}>
                      No pilot participants yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.userId}>
                      <td style={cellStyle}>{r.name}</td>
                      <td style={cellStyle}>{r.email}</td>
                      <td style={{ ...cellStyle, color: r.organizationName ? "var(--text)" : "var(--text-muted)" }}>
                        {r.organizationName ?? "— individual —"}
                      </td>
                      <td style={{ ...cellStyle, textAlign: "right", color: "var(--teal)", fontWeight: 700 }}>
                        {r.careerHealthScore ?? "—"}
                      </td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>
                        {r.assessmentsCompleted}/{r.totalAssessments}
                      </td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>{r.plans}</td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>
                        {r.milestonesDone}/{r.milestonesTotal}
                      </td>
                      <td style={{ ...cellStyle, textAlign: "right" }}>
                        {new Date(r.joined).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
