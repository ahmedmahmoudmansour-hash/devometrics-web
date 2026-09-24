import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationId, amIActiveOrgMember } from "@/lib/organizations/membership";
import { listMyEligibleLeaveTypes, getMyLeaveBalances, listMyLeaveRequests } from "@/lib/leave/actions";
import { listMyHrLetterRequests } from "@/lib/hrLetters/actions";
import MyServices from "@/components/dashboard/MyServices";

export const metadata = { title: "Services — Devometrics" };

// Kept at the same /dashboard/leave URL deliberately (2026-09-23 rename) —
// only the visible label/title changed from "Leave" to "Services", not
// the route, so no bookmarks or nav-highlighting logic break.
export default async function MyServicesPage() {
  const t = await getTranslations("myServicesPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  if (!organizationId) redirect("/dashboard");

  // 0172 gates real access on employment_status, but getMyOrganizationId
  // above can still resolve for a resigned/terminated member (0145's
  // deliberate self-visible carve-out) — without this check they'd see a
  // full "Services" page rendered with every list silently empty, which
  // reads as "the company hasn't set anything up" rather than "you no
  // longer have access." See amIActiveOrgMember's own comment.
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

  const currentYear = new Date().getFullYear();
  const [leaveTypes, balances, requests, hrLetterRequests] = await Promise.all([
    listMyEligibleLeaveTypes(organizationId),
    getMyLeaveBalances(currentYear),
    listMyLeaveRequests(),
    listMyHrLetterRequests(),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
        </div>

        <MyServices
          organizationId={organizationId}
          leaveTypes={leaveTypes}
          balances={balances}
          initialLeaveRequests={requests}
          initialHrLetterRequests={hrLetterRequests}
        />
      </div>
    </div>
  );
}
