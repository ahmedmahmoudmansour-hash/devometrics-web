import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listMyDirectReportReviews, getPendingProbationAcceptances } from "@/lib/performanceReviews/actions";
import { listMyTeamPulse } from "@/lib/organizations/teamPulse";
import { dimensionLabel } from "@/lib/gap-analysis/dimensions";
import MyTeamReviews from "@/components/dashboard/MyTeamReviews";
import ProbationAcceptanceCard from "@/components/dashboard/ProbationAcceptanceCard";
import { ScoreBar } from "@/components/dashboard/charts";

export const metadata = { title: "My Team — Devometrics" };

// For a real reporting-line manager who ISN'T necessarily an org admin
// (migration 0078) — the admin-only Impact Cycles page manages cycles
// org-wide; this is the narrower "conduct my own direct reports' reviews"
// surface a plain manager actually needs.
export default async function MyTeamPage() {
  const t = await getTranslations("myTeamPage");
  const tDim = await getTranslations("competencyDimensions");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { items, error } = await listMyDirectReportReviews();
  const { members: pulseMembers } = await listMyTeamPulse();
  const pendingProbationAcceptances = await getPendingProbationAcceptances();

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
                </div>
              ))}
            </div>
          </div>
        )}

        <ProbationAcceptanceCard initial={pendingProbationAcceptances} />

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
