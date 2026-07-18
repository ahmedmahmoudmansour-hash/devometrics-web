import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listReviewCycles } from "@/lib/performanceReviews/actions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import PerformanceReviewsManager from "@/components/dashboard/PerformanceReviewsManager";

export const metadata = { title: "Impact Cycles — Devometrics" };

export default async function ImpactCyclesPage() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const { cycles, error } = await listReviewCycles();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Impact Cycles
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            Named cycles built around what someone actually did in a period — Your Reflection from the
            employee, a Manager&apos;s Perspective, Focus Areas, and a confirm-and-close step — not just
            a single rating. The rating from a closed-out cycle automatically updates the performance
            rating shown on Scorecard and Analytics, so nothing else needs to change to pick it up.
          </p>
        </div>

        <CompanyNavTabs active="performanceReviews" />

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              Impact Cycles isn&apos;t enabled on this database yet — the{" "}
              <code style={{ color: "var(--teal)" }}>0076_performance_appraisals.sql</code> migration
              needs to be run in the Supabase SQL Editor first.
            </p>
          </div>
        ) : (
          <PerformanceReviewsManager initialCycles={cycles} />
        )}
      </div>
    </div>
  );
}
