import Link from "next/link";
import { redirect } from "next/navigation";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import HiringPostingsManager from "@/components/dashboard/HiringPostingsManager";
import { buildHiringOverview } from "@/lib/hiring/aggregate";

export const metadata = { title: "Hiring — Devometrics" };

export default async function HiringPage() {
  const data = await buildHiringOverview();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>Hiring</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            Post a role, let AI propose its required competency profile, then run every candidate&apos;s
            CV through the same scoring engine behind Gap Analysis. Interview notes you write in get
            turned into a structured assessment, and candidates can be compared side by side before you
            decide. Hiring someone converts them straight into an employee with their competency profile
            already in place.
          </p>
        </div>

        <CompanyNavTabs active="hiring" />

        <HiringPostingsManager postings={data.postings} linkableRoles={data.linkableRoles} />
      </div>
    </div>
  );
}
