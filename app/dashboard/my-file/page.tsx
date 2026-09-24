import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationId, amIActiveOrgMember } from "@/lib/organizations/membership";
import { getEmployeeFile, getDisabledFileSections } from "@/lib/employeeFile/actions";
import EmployeeFileEditor from "@/components/dashboard/EmployeeFileEditor";

export const metadata = { title: "My file — Devometrics" };

export default async function MyFilePage() {
  const t = await getTranslations("employeeFile");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  if (!organizationId) redirect("/dashboard");

  // Same lockout treatment as Services/Directory — a resigned or terminated
  // member can still resolve an organization_id but has no access to it.
  const isActive = await amIActiveOrgMember(supabase, user.id);
  if (!isActive) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginTop: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("noAccessTitle")}</h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>{t("noAccessDescription")}</p>
          </div>
        </div>
      </div>
    );
  }

  const [bundle, disabledSections] = await Promise.all([getEmployeeFile(organizationId), getDisabledFileSections(organizationId)]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("myFileTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("myFileDescription")}</p>
        </div>

        <EmployeeFileEditor mode="self" organizationId={organizationId} userId={user.id} initial={bundle} disabledSections={disabledSections} />
      </div>
    </div>
  );
}
