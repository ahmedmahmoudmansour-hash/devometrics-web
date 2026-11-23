import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import AssessmentsManager from "@/components/assessment/AssessmentsManager";
import TeamResults from "@/components/knowledgeCheck/TeamResults";
import { getTeamKnowledgeResults } from "@/lib/knowledgeBank/actions";
import { listManagedRoleAssessments, purgeExpiredRoleAssessmentAnswers } from "@/lib/assessment/actions";
import { listManagedKnowledgeChecks } from "@/lib/knowledgeBank/actions";

export const metadata = { title: "Role assessments — Devometrics" };
export const maxDuration = 120;

// For a line manager: assign a role assessment to a direct report, then review and confirm the results.
export default async function MyTeamRoleAssessmentsPage({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const { person } = await searchParams;
  const t = await getTranslations("roleAssessment");
  const tReadiness = await getTranslations("readiness");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await purgeExpiredRoleAssessmentAnswers();
  const managed = await listManagedRoleAssessments();
  const knowledge = await listManagedKnowledgeChecks();
  const team = await getTeamKnowledgeResults();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/my-team" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("back")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("manageTitle")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>{t("manageIntro")}</p>
          <Link href="/dashboard/my-team/readiness" style={{ display: "inline-block", marginTop: 10, color: "var(--teal)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            {tReadiness("mgr_link")} →
          </Link>
        </div>
        {"error" in managed ? (
          <p style={{ color: "var(--danger)", fontSize: 13 }}>{managed.error}</p>
        ) : (
          <AssessmentsManager
            roleRows={managed.rows}
            checkRows={"error" in knowledge ? [] : knowledge.rows}
            checksReady={!("error" in knowledge) && knowledge.ready}
            names={managed.names}
            employees={managed.employees}
            roles={managed.roles}
            viewer="manager"
            settings={managed.settings}
            initialPerson={typeof person === "string" ? person : undefined}
          />
        )}
        {team && team.people.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <TeamResults data={team} isAdmin={false} />
          </div>
        )}
      </div>
    </div>
  );
}
