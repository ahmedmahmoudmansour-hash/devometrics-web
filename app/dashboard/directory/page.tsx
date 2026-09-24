import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationId, amIActiveOrgMember } from "@/lib/organizations/membership";
import { getDirectoryEnabled, listDirectoryEntries } from "@/lib/directory/actions";
import EmployeeDirectory from "@/components/dashboard/EmployeeDirectory";

export const metadata = { title: "Directory — Devometrics" };

export default async function DirectoryPage() {
  const t = await getTranslations("employeeDirectory");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  if (!organizationId) redirect("/dashboard");

  // Same lockout treatment as Services (app/dashboard/leave/page.tsx) — see
  // amIActiveOrgMember's own comment for why this needs its own check
  // beyond just "did an organization_id resolve."
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

  const enabled = await getDirectoryEnabled(organizationId);
  if (!enabled) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginTop: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{t("notEnabledTitle")}</h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>{t("notEnabledDescription")}</p>
          </div>
        </div>
      </div>
    );
  }

  const entries = await listDirectoryEntries(organizationId);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
        </div>

        <EmployeeDirectory entries={entries} myUserId={user.id} />
      </div>
    </div>
  );
}
