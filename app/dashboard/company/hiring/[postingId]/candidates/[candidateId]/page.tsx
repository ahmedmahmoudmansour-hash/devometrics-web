import Link from "next/link";
import { redirect } from "next/navigation";
import { UserSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import CandidateDetailView from "@/components/dashboard/CandidateDetailView";
import { buildCandidateDetail } from "@/lib/hiring/aggregate";

export const metadata = { title: "Candidate — Devometrics" };

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ postingId: string; candidateId: string }>;
}) {
  const t = await getTranslations("hiringCandidateDetailPage");
  const { postingId, candidateId } = await params;
  const data = await buildCandidateDetail(candidateId);
  if (!data.isAuthorized || !data.candidate) redirect(`/dashboard/company/hiring/${postingId}`);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href={`/dashboard/company/hiring/${postingId}`} style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToPipeline")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
            <UserSearch size={22} style={{ color: "var(--teal)" }} />
            {data.candidate.full_name}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {data.candidate.email}
            {data.posting ? t("applyingFor", { title: data.posting.title }) : ""}
          </p>
        </div>

        <CompanyNavTabs active="hiring" />

        <CandidateDetailView
          candidate={data.candidate}
          cvScore={data.cvScore}
          notes={data.notes}
          assessment={data.assessment}
          stageHistory={data.stageHistory}
        />
      </div>
    </div>
  );
}
