import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getMyDisabledCompanyFeatures } from "@/lib/organizations/companyFeatures";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import FeatureSwitchesForm from "@/components/dashboard/FeatureSwitchesForm";

export const metadata = { title: "Tiles & features — Devometrics" };

export default async function CompanyFeaturesPage() {
  const t = await getTranslations("companyHub");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");
  const disabled = await getMyDisabledCompanyFeatures();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/company" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToCompany")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("featuresTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("featuresDescription")}</p>
        </div>

        <CompanyNavTabs active="features" />

        <FeatureSwitchesForm organizationId={data.organizationId} initialDisabled={disabled} />
      </div>
    </div>
  );
}
