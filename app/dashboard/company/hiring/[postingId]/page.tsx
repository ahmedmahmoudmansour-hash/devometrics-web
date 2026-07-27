import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import HiringPipelineBoard from "@/components/dashboard/HiringPipelineBoard";
import { buildJobPostingDetail } from "@/lib/hiring/aggregate";

export const metadata = { title: "Job posting — Devometrics" };

export default async function JobPostingPage({ params }: { params: Promise<{ postingId: string }> }) {
  const { postingId } = await params;
  const data = await buildJobPostingDetail(postingId);
  if (!data.isAuthorized || !data.posting || !data.organizationId) redirect("/dashboard/company/hiring");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/company/hiring" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to Hiring
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
            <Briefcase size={22} style={{ color: "var(--teal)" }} />
            {data.posting.title}
          </h1>
        </div>

        <CompanyNavTabs active="hiring" />

        <HiringPipelineBoard
          organizationId={data.organizationId}
          posting={data.posting}
          requirements={data.requirements}
          candidates={data.candidates}
        />
      </div>
    </div>
  );
}
