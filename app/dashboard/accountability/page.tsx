import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listMyAccountabilityGroups } from "@/lib/accountability/actions";
import AccountabilityGroupsView from "@/components/dashboard/AccountabilityGroupsView";

export const metadata = { title: "Accountability Groups — Devometrics" };

export default async function AccountabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("accountabilityGroups");
  const { groups, error } = await listMyAccountabilityGroups();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            {t("subtitle")}
          </p>
        </div>

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t("migrationNoticeBefore")}{" "}
              <code style={{ color: "var(--teal)" }}>0075_accountability_groups.sql</code>{" "}
              {t("migrationNoticeAfter")}
            </p>
          </div>
        ) : (
          <AccountabilityGroupsView initial={groups} />
        )}
      </div>
    </div>
  );
}
