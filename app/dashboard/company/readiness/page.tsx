import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import ReadinessView from "@/components/dashboard/ReadinessView";
import { computeReadiness, sampleReadiness } from "@/lib/readiness/core";
import { loadReadinessInput } from "@/lib/readiness/load";

export const metadata = { title: "Talent readiness — Devometrics" };

// Talent readiness: the chain from what each job needs, to who has been assessed, to the gaps, to development, on one page. ?sample=1 shows
// made-up people, so the page can be demonstrated before any real data exists.
export default async function ReadinessPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const { sample } = await searchParams;
  const t = await getTranslations("readiness");
  const tr = await getTranslations("roleAssessment");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const useSample = sample === "1";
  const readiness = useSample ? sampleReadiness() : computeReadiness(await loadReadinessInput(data.organizationId));

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div className="dashboard-wide-content">
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" className="no-print" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {tr("back")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
        </div>
        <div className="no-print">
          <CompanyNavTabs active="readiness" />
        </div>
        <ReadinessView readiness={readiness} sample={useSample} />
      </div>
    </div>
  );
}
