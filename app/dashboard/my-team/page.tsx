import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listMyDirectReportReviews, getPendingProbationAcceptances } from "@/lib/performanceReviews/actions";
import { listMyTeamPulse } from "@/lib/organizations/teamPulse";
import { dimensionLabel } from "@/lib/gap-analysis/dimensions";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { listTeamCompensation, listSalaryBands, listCompensationProposals } from "@/lib/compensation/actions";
import { listTeamLeaveRequests, listLeaveTypes, listTeamLeaveOverview } from "@/lib/leave/actions";
import MyTeamReviews from "@/components/dashboard/MyTeamReviews";
import ProbationAcceptanceCard from "@/components/dashboard/ProbationAcceptanceCard";
import TeamCompensationSection from "@/components/dashboard/TeamCompensationSection";
import MyCompensationProposals from "@/components/dashboard/MyCompensationProposals";
import TeamLeaveSection from "@/components/dashboard/TeamLeaveSection";
import TeamLeaveOverview from "@/components/dashboard/TeamLeaveOverview";
import TeamEmploymentHistory from "@/components/dashboard/TeamEmploymentHistory";
import { getEmployeeHistory, type EmploymentHistoryEvent } from "@/lib/employmentHistory/actions";
import { ScoreBar } from "@/components/dashboard/charts";

export const metadata = { title: "My Team — Devometrics" };

// For a real reporting-line manager who ISN'T necessarily an org admin
// (migration 0078) — the admin-only Impact Cycles page manages cycles
// org-wide; this is the narrower "conduct my own direct reports' reviews"
// surface a plain manager actually needs.
function formatScoreValue(rawValue: number, scale: "0_100" | "1_5"): string {
  return scale === "1_5" ? `${rawValue.toFixed(1)}/5` : `${Math.round(rawValue)}`;
}

export default async function MyTeamPage() {
  const t = await getTranslations("myTeamPage");
  const tDim = await getTranslations("competencyDimensions");
  const tScoreSource = await getTranslations("scoreEventSources");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { items, error } = await listMyDirectReportReviews();
  const { members: pulseMembers } = await listMyTeamPulse();
  const pendingProbationAcceptances = await getPendingProbationAcceptances();

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const [teamCompensation, salaryBands, myProposals, teamLeaveRequestsRaw, leaveTypes, teamLeaveOverviewRaw] = organizationId
    ? await Promise.all([
        listTeamCompensation(organizationId),
        listSalaryBands(organizationId),
        listCompensationProposals(organizationId),
        listTeamLeaveRequests(organizationId),
        listLeaveTypes(organizationId),
        listTeamLeaveOverview(organizationId),
      ])
    : [[], [], [], [], [], []];
  const employeeNames = Object.fromEntries(pulseMembers.map((m) => [m.userId, { name: m.name, email: m.email }]));
  // listTeamLeaveRequests relies on RLS (self OR org-admin OR manager-of),
  // which is broader than "my direct reports" for a manager who's also an
  // org admin — filter down to pulseMembers (the same direct-report set
  // everything else on this page already uses) so "team" stays accurate.
  const directReportIds = new Set(pulseMembers.map((m) => m.userId));
  const teamLeaveRequests = teamLeaveRequestsRaw.filter((r) => directReportIds.has(r.employeeUserId));

  // One RPC call per direct report — list_employee_history() (0170)
  // itself enforces per-employee authorization (self/admin/manager-with-
  // visibility), so this naturally returns [] for anyone the org's
  // employment_history_manager_visibility setting hides.
  const historyEntries = await Promise.all(pulseMembers.map((m) => getEmployeeHistory(m.userId).then((events) => [m.userId, events] as const)));
  const employmentHistoryByEmployee: Record<string, EmploymentHistoryEvent[]> = Object.fromEntries(historyEntries);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            {t("description")}
          </p>
        </div>

        {pulseMembers.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("teamPulseTitle")}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{t("teamPulseHint")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {pulseMembers.map((m) => (
                <div key={m.userId} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{m.name}</p>
                  {m.careerHealthScore === null ? (
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>{t("teamPulseNoAnalysis")}</p>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("teamPulseCareerHealth")}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--teal)" }}>{m.careerHealthScore}</span>
                      </div>
                      <ScoreBar value={m.careerHealthScore} />
                      {m.topGap && (
                        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
                          {t("teamPulseTopGap", { dimension: dimensionLabel(tDim, m.topGap.dimension), gap: m.topGap.gapSize })}
                        </p>
                      )}
                    </>
                  )}
                  {m.otherScores.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      {m.otherScores.map((s, i) => (
                        <span
                          key={`${s.source}-${i}`}
                          title={new Date(s.recordedAt).toLocaleDateString()}
                          style={{
                            fontSize: 11,
                            color: "var(--text)",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid var(--border)",
                            borderRadius: 999,
                            padding: "3px 9px",
                          }}
                        >
                          {tScoreSource(s.source)}: <span style={{ fontWeight: 700 }}>{formatScoreValue(s.rawValue, s.scale)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <ProbationAcceptanceCard initial={pendingProbationAcceptances} />

        {organizationId && (
          <>
            <TeamLeaveSection initialRequests={teamLeaveRequests} leaveTypes={leaveTypes} employeeNames={employeeNames} />
            <TeamLeaveOverview balances={teamLeaveOverviewRaw} leaveTypes={leaveTypes} employeeNames={employeeNames} />
            <TeamEmploymentHistory eventsByEmployee={employmentHistoryByEmployee} employeeNames={employeeNames} />
            <MyCompensationProposals initialProposals={myProposals} employeeNames={employeeNames} />
            <TeamCompensationSection
              organizationId={organizationId}
              initialRows={teamCompensation}
              salaryBands={salaryBands}
              employeeNames={employeeNames}
            />
          </>
        )}

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("notEnabledYet", {
                code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code>,
              })}
            </p>
          </div>
        ) : (
          <MyTeamReviews initial={items} />
        )}
      </div>
    </div>
  );
}
