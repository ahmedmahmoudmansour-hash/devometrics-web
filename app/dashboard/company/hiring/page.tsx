import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { getTranslations } from "next-intl/server";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import HiringPostingsManager from "@/components/dashboard/HiringPostingsManager";
import HiringAttentionWidget from "@/components/dashboard/HiringAttentionWidget";
import FeatureEmailComposer from "@/components/dashboard/FeatureEmailComposer";
import { buildHiringOverview } from "@/lib/hiring/aggregate";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listFeatureEmailHistory } from "@/lib/organizations/featureEmails";
import { getHiringAttentionSummary } from "@/lib/hiring/attentionSummary";

export const metadata = { title: "Hiring — Devometrics" };

export default async function HiringPage() {
  const t = await getTranslations("hiringPage");
  const [data, company] = await Promise.all([buildHiringOverview(), buildCompanyData()]);
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div className="dashboard-wide-content">
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
            <Briefcase size={22} style={{ color: "var(--teal)" }} />
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="hiring" />

        {data.organizationId && <HiringAttentionWidget items={await getHiringAttentionSummary(data.organizationId)} />}

        {data.organizationId && (
          <FeatureEmailComposer
            organizationId={data.organizationId}
            featureKey="hiring"
            employees={company.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email, department: r.department }))}
            initialHistory={await listFeatureEmailHistory(data.organizationId, "hiring")}
          />
        )}

        <HiringPostingsManager postings={data.postings} linkableRoles={data.linkableRoles} />
      </div>
    </div>
  );
}
