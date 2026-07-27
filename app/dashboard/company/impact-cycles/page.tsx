import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listReviewCycles } from "@/lib/performanceReviews/actions";
import { createClient } from "@/lib/supabase/server";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import PerformanceReviewsManager from "@/components/dashboard/PerformanceReviewsManager";
import EscalationLevelsSetting from "@/components/dashboard/EscalationLevelsSetting";

export const metadata = { title: "Impact Cycles — Devometrics" };

export default async function ImpactCyclesPage() {
  const t = await getTranslations("companyImpactCyclesPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const { cycles, error } = await listReviewCycles();

  // Isolated from buildCompanyData's main query — a small, feature-specific
  // field not worth adding to that already-large shared aggregate. Degrades
  // to the default (1 = direct manager only) if migration 0082 hasn't run.
  let escalationLevels = 1;
  if (!error && data.organizationId) {
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("review_escalation_levels")
      .eq("id", data.organizationId)
      .maybeSingle<{ review_escalation_levels: number | null }>();
    escalationLevels = org?.review_escalation_levels ?? 1;
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="performanceReviews" />

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("notEnabledYet", {
                code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code>,
              })}
            </p>
          </div>
        ) : (
          <>
            <EscalationLevelsSetting organizationId={data.organizationId!} initialLevels={escalationLevels} />
            <PerformanceReviewsManager initialCycles={cycles} />
          </>
        )}
      </div>
    </div>
  );
}
