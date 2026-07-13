import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import SuccessionBoard from "@/components/dashboard/SuccessionBoard";
import { forecastReadiness, type ReadinessForecast } from "@/lib/succession/forecast";
import type { SuccessionRole, SuccessionNomination } from "@/lib/supabase/types";

export const metadata = { title: "Succession — Devometrics" };

export default async function SuccessionPage() {
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
  const forecastEntries = await Promise.all(
    [...candidateIds].map(async (id) => [id, await forecastReadiness(id)] as const)
  );
  const forecastsByUserId = Object.fromEntries(forecastEntries) as Record<string, ReadinessForecast>;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Succession Planning
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            Define a critical role and the AI ranks your people by measured fit — with the
            reasoning, gaps, and development focus for each candidate. Decision support for a human
            conversation, never an automated decision.
          </p>
        </div>

        <CompanyNavTabs active="succession" />

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", padding: 28, borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Succession planning isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0052_succession_roles.sql</code> migration needs
              to be run in the Supabase SQL Editor first.
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
