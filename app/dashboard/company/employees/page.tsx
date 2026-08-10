import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS, dimensionLabel } from "@/lib/gap-analysis/dimensions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import Avatar from "@/components/Avatar";
import EmployeesTable from "@/components/dashboard/EmployeesTable";
import FeatureEmailComposer from "@/components/dashboard/FeatureEmailComposer";
import { listFeatureEmailHistory } from "@/lib/organizations/featureEmails";
import { levelBg } from "@/lib/ui/levelColor";

export default async function CompanyEmployeesPage() {
  const t = await getTranslations("companyEmployeesPage");
  const tDim = await getTranslations("competencyDimensions");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

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
              {t("backToProgress")}
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
              {data.organizationName}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {t("teamMemberCount", { count: data.rows.length })}
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
              {t("exportExcel")}
            </a>
          )}
          {data.companyCareerHealthScore !== null && (
            <div style={{ textAlign: "end" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "var(--teal)" }}>
                  {data.companyCareerHealthScore}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("companyCareerHealthScoreLabel")}</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {t("companyCareerHealthScoreCaption")}
              </p>
            </div>
          )}
        </div>

        <CompanyNavTabs active="employees" />

        {data.rows.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("noTeamMembersPrefix")}{" "}
              <Link href="/dashboard/company" style={{ color: "var(--teal)" }}>
                {t("profileLinkLabel")}
              </Link>{" "}
              {t("noTeamMembersSuffix")}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {data.organizationId && (
              <FeatureEmailComposer
                organizationId={data.organizationId}
                featureKey="assessment"
                employees={data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email, department: r.department }))}
                initialHistory={await listFeatureEmailHistory(data.organizationId, "assessment")}
              />
            )}

            {/* Workforce skill inventory */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                {t("workforceSkillInventory")}
              </h2>
              <EmployeesTable rows={data.rows} currentUserId={currentUser?.id ?? null} />
            </div>

            {/* Capability pyramid, team average */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                {t("teamCapabilityPyramid")}
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                {t("teamCapabilityPyramidDesc")}
              </p>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, display: "flex", justifyContent: "center" }}>
                <CapabilityPyramid dimensionLevels={data.dimensionAverages} />
              </div>
            </div>

            {/* Talent heatmap */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                {t("talentHeatmap")}
              </h2>
              <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...headStyle, textAlign: "start" }}>{t("tableName")}</th>
                        {COMPETENCY_DIMENSIONS.map((d) => (
                          <th key={d} style={{ ...headStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                            {dimensionLabel(tDim, d)}
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
                        <td style={{ ...cellStyle, fontWeight: 700, color: "var(--text-muted)" }}>{t("teamAverage")}</td>
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
                {t("talentHeatmapNote")}
              </p>
            </div>

            {/* Leadership readiness signal */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                {t("leadershipReadinessSignal")}
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
                {t("leadershipReadinessDesc")}
              </p>
              {data.leadershipReadiness.length === 0 ? (
                <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {t("noRankingYet")}
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
