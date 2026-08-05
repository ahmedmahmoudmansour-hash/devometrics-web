import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import SuccessionBoard from "@/components/dashboard/SuccessionBoard";
import { forecastReadinessBatch } from "@/lib/succession/forecast";
import type { SuccessionRole, SuccessionNomination } from "@/lib/supabase/types";

export const metadata = { title: "Succession — Devometrics" };

export default async function SuccessionPage() {
  const t = await getTranslations("successionPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data: roles, error } = await supabase
    .from("succession_roles")
    .select("*")
    .eq("organization_id", data.organizationId!)
    .order("created_at", { ascending: false })
    .returns<SuccessionRole[]>();

  // Nominations and forecasts are additive — a missing 0061 migration
  // shouldn't break the core AI-ranking view, same "isolated defensive
  // query" pattern used elsewhere in this file (e.g. organizationPendingDeletionAt).
  const roleIds = (roles ?? []).map((r) => r.id);
  const { data: nominationRows } = roleIds.length
    ? await supabase
        .from("succession_nominations")
        .select("*")
        .in("role_id", roleIds)
        .returns<SuccessionNomination[]>()
    : { data: [] as SuccessionNomination[] };

  const nominationsByRole = new Map<string, SuccessionNomination[]>();
  for (const n of nominationRows ?? []) {
    const list = nominationsByRole.get(n.role_id) ?? [];
    list.push(n);
    nominationsByRole.set(n.role_id, list);
  }

  // One forecast per unique candidate across every role's report — a
  // person's Career Health Score trend doesn't depend on which role they're
  // being considered for, so it's computed once and reused.
  const candidateIds = new Set<string>();
  for (const r of roles ?? []) {
    for (const c of r.report?.candidates ?? []) candidateIds.add(c.userId);
  }
  const forecastsByUserId = await forecastReadinessBatch([...candidateIds]);

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
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="succession" />

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", padding: 28, borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("migrationNotEnabled", {
                code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code>,
              })}
            </p>
          </div>
        ) : (
          <SuccessionBoard
            roles={roles ?? []}
            employeeCount={data.rows.length}
            employees={data.rows.map((r) => ({ userId: r.userId, name: r.name }))}
            nominationsByRole={Object.fromEntries(nominationsByRole)}
            forecastsByUserId={forecastsByUserId}
          />
        )}
      </div>
    </div>
  );
}
