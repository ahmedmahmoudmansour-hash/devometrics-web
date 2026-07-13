import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import InviteEmployeeForm from "@/components/dashboard/InviteEmployeeForm";
import OrganizationProfileForm from "@/components/dashboard/OrganizationProfileForm";
import OrganizationContactsForm from "@/components/dashboard/OrganizationContactsForm";
import OrganizationBrandingForm from "@/components/dashboard/OrganizationBrandingForm";
import DeleteCompanyButton from "@/components/dashboard/DeleteCompanyButton";
import InviteCodeDisplay from "@/components/dashboard/InviteCodeDisplay";

export default async function CompanyProfilePage() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            {data.organizationLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- customer-supplied external logo URL, not a static asset next/image can optimize meaningfully
              <img
                src={data.organizationLogoUrl}
                alt={`${data.organizationName} logo`}
                style={{ height: 28, width: "auto", borderRadius: 4 }}
              />
            )}
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
              {data.organizationName}
            </h1>
          </div>
          {data.organizationSlug && <InviteCodeDisplay slug={data.organizationSlug} />}
        </div>

        <CompanyNavTabs active="profile" />

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Only your own company&apos;s members appear here — this is scoped to your organization, not
          a shared pilot-wide view. Everyone below uses the exact same individual tools as any other
          Devometrics account; this dashboard just aggregates what they&apos;ve already done.
        </p>

        {data.organizationId && (
          <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 24 }}>
            <InviteEmployeeForm organizationId={data.organizationId} pendingInvites={data.pendingInvites} />
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
          </div>
        )}

        {data.organizationId && (
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
            <DeleteCompanyButton
              organizationId={data.organizationId}
              organizationName={data.organizationName ?? "this workspace"}
              pendingDeletionAt={data.organizationPendingDeletionAt}
            />
          </div>
        )}
      </div>
    </div>
  );
}
