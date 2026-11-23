import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import ReadinessView from "@/components/dashboard/ReadinessView";
import { computeReadiness, sampleReadiness } from "@/lib/readiness/core";
import { loadReadinessInput } from "@/lib/readiness/load";
import { hasLeft } from "@/lib/organizations/leaver";

export const metadata = { title: "Team readiness — Devometrics" };

// For a line manager: is my team ready for the jobs they hold, where are the gaps, what next. Only the manager's own direct reports are read
// (the database enforces that too). ?sample=1 shows a made-up team, so the page can be demonstrated.
export default async function MyTeamReadinessPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const { sample } = await searchParams;
  const t = await getTranslations("readiness");
  const tr = await getTranslations("roleAssessment");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const { data: reports } = organizationId
    ? await supabase.from("organization_members").select("user_id, archived, employment_status").eq("organization_id", organizationId).eq("manager_user_id", user.id).returns<{ user_id: string; archived: boolean | null; employment_status: string | null }[]>()
    : { data: null };
  // People who have left (archived, resigned or terminated) are not part of the team any more.
  const reportIds = (reports ?? []).filter((r) => !hasLeft(r)).map((r) => r.user_id).filter((id) => id !== user.id);
  // Someone with nobody reporting to them has no team to show.
  if (reportIds.length === 0 && sample !== "1") redirect("/dashboard/my-team");

  const useSample = sample === "1";
  const readiness = useSample ? sampleReadiness("manager") : computeReadiness(await loadReadinessInput(organizationId as string, reportIds), "manager");

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/my-team" className="no-print" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {tr("back")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("mgr_title")}</h1>
        </div>
        <ReadinessView readiness={readiness} sample={useSample} audience="manager" />
      </div>
    </div>
  );
}
