import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import SuccessionBoard from "@/components/dashboard/SuccessionBoard";
import type { SuccessionRole } from "@/lib/supabase/types";

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
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Succession planning isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0052_succession_roles.sql</code> migration needs
              to be run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <SuccessionBoard roles={roles ?? []} employeeCount={data.rows.length} />
        )}
      </div>
    </div>
  );
}
