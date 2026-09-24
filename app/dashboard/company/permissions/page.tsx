import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import FeaturePermissionsManager from "@/components/dashboard/FeaturePermissionsManager";
import CompensationAdminGrantsManager from "@/components/dashboard/CompensationAdminGrantsManager";
import OrgOwnershipManager from "@/components/dashboard/OrgOwnershipManager";
import { listOrgFeatureRestrictions } from "@/lib/organizations/featureAccess";
import { listCompensationAdmins, isCompensationGrantOwner } from "@/lib/organizations/compensationAccess";
import { getOrgOwnershipInfo } from "@/lib/organizations/ownership";

export const metadata = { title: "Permissions — Devometrics" };

export default async function CompanyPermissionsPage() {
  const t = await getTranslations("companyPermissionsPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const restrictions = await listOrgFeatureRestrictions(data.organizationId);
  const compensationAdmins = await listCompensationAdmins(data.organizationId);
  const isCompensationOwner = await isCompensationGrantOwner(data.organizationId);
  const ownership = await getOrgOwnershipInfo(data.organizationId);
  const departments = Array.from(new Set(data.rows.map((r) => r.department).filter((d): d is string => !!d))).sort();
  const employees = data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email }));
  const admins = data.rows.filter((r) => r.role === "admin").map((r) => ({ userId: r.userId, name: r.name, email: r.email }));

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="permissions" />

        <FeaturePermissionsManager
          organizationId={data.organizationId}
          initialRestrictions={restrictions}
          employees={employees}
          departments={departments}
        />

        <div style={{ marginTop: 32 }}>
          {user && (
            <OrgOwnershipManager
              organizationId={data.organizationId}
              ownership={ownership}
              currentUserId={user.id}
              admins={admins}
            />
          )}
          <CompensationAdminGrantsManager
            organizationId={data.organizationId}
            initialGrants={compensationAdmins}
            employees={employees}
            isOwner={isCompensationOwner}
          />
        </div>
      </div>
    </div>
  );
}
