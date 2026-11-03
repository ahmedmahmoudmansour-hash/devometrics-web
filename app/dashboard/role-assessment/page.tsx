import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getAssessmentSettings, listMyRoleAssessments, purgeExpiredRoleAssessmentAnswers } from "@/lib/assessment/actions";
import StartRoleAssessmentButton from "@/components/assessment/StartRoleAssessmentButton";

export const metadata = { title: "Role assessment — Devometrics" };
// Preparing questions can take a while the first time a competency is used.
export const maxDuration = 120;

export default async function RoleAssessmentPage() {
  const t = await getTranslations("roleAssessment");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await purgeExpiredRoleAssessmentAnswers();
  const [rows, settings] = await Promise.all([listMyRoleAssessments(), getAssessmentSettings()]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("back")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>{t("intro")}</p>
        </div>

        <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("yourAssessments")}</h2>
          {rows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>{t("none")}</p>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/role-assessment/${r.id}`}
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}
                >
                  <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 600 }}>
                    {r.roleTitle}
                    <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 12, marginInlineStart: 8 }}>
                      {t("competencyCount", { count: r.competencyCount })} · {t("createdOn", { date: format.dateTime(new Date(r.createdAt), { dateStyle: "medium" }) })}
                    </span>
                  </span>
                  <span style={{ color: r.status === "scored" ? "var(--teal)" : "var(--text-muted)", fontSize: 12, fontWeight: 700 }}>{t(`status_${r.status}`)}</span>
                </Link>
              ))}
            </div>
          )}
          {settings.selfStartAllowed && <StartRoleAssessmentButton />}
        </div>
      </div>
    </div>
  );
}
