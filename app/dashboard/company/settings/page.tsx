import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import OrganizationProfileForm from "@/components/dashboard/OrganizationProfileForm";
import OrganizationContactsForm from "@/components/dashboard/OrganizationContactsForm";
import OrganizationBrandingForm from "@/components/dashboard/OrganizationBrandingForm";
import EmailMessagesForm from "@/components/dashboard/EmailMessagesForm";
import DeleteCompanyButton from "@/components/dashboard/DeleteCompanyButton";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import { getOrganizationEmailMessages } from "@/lib/organizations/emailMessages";

// Split out of app/dashboard/company/page.tsx (the 2026-08 UX audit's
// clearest finding: that page was doing four unrelated jobs — overview,
// a feature directory, org settings, and account deletion — on one URL).
// This route is the "config, rarely visited" half; the overview page keeps
// the "health, checked often" half. Same buildCompanyData() call as the
// overview page — it's already shared across 44+ call sites in this
// codebase, so reusing it here is free, not a new data dependency.
export default async function CompanySettingsPage() {
  const t = await getTranslations("companyProfilePage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");
  const emailMessages = data.organizationId ? await getOrganizationEmailMessages(data.organizationId) : null;

  if (!data.organizationId) redirect("/dashboard/company");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/dashboard/company" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToOverview")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 8 }}>
            {t("settingsTitle")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
            {t("settingsSubtitle", { name: data.organizationName ?? "" })}
          </p>
        </div>

        <CompanyNavTabs active="settings" />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <OrganizationProfileForm
            organizationId={data.organizationId}
            initial={{
              website: data.organizationWebsite,
              employeeCount: data.organizationEmployeeCount,
              industry: data.organizationIndustry,
            }}
          />
          <OrganizationContactsForm
            organizationId={data.organizationId}
            initial={{
              platformContactName: data.organizationPlatformContactName,
              platformContactEmail: data.organizationPlatformContactEmail,
              financeContactName: data.organizationFinanceContactName,
              financeContactEmail: data.organizationFinanceContactEmail,
            }}
          />
          <OrganizationBrandingForm
            organizationId={data.organizationId}
            initial={{ logoUrl: data.organizationLogoUrl, brandColor: data.organizationBrandColor }}
          />
          {emailMessages && <EmailMessagesForm organizationId={data.organizationId} initial={emailMessages} />}
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          <DeleteCompanyButton
            organizationId={data.organizationId}
            organizationName={data.organizationName ?? "this workspace"}
            pendingDeletionAt={data.organizationPendingDeletionAt}
          />
        </div>
      </div>
    </div>
  );
}
