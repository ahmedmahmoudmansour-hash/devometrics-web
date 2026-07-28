import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { getTranslations } from "next-intl/server";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import HiringPostingsManager from "@/components/dashboard/HiringPostingsManager";
import { buildHiringOverview } from "@/lib/hiring/aggregate";

export const metadata = { title: "Hiring — Devometrics" };

export default async function HiringPage() {
  const t = await getTranslations("hiringPage");
  const data = await buildHiringOverview();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
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

        <HiringPostingsManager postings={data.postings} linkableRoles={data.linkableRoles} />
      </div>
    </div>
  );
}
