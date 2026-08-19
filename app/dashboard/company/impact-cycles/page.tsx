import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listReviewCycles, getEscalatedReviews } from "@/lib/performanceReviews/actions";
import { getOrCreateDefaultWorkflowTemplate } from "@/lib/performanceReviews/workflowActions";
import { listOrganizationCompetencies } from "@/lib/organizations/competencies";
import { createClient } from "@/lib/supabase/server";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import PerformanceReviewsManager from "@/components/dashboard/PerformanceReviewsManager";
import EscalatedReviewsWidget from "@/components/dashboard/EscalatedReviewsWidget";
import EscalationLevelsSetting from "@/components/dashboard/EscalationLevelsSetting";
import PerformanceReviewWorkflowEditor from "@/components/dashboard/PerformanceReviewWorkflowEditor";
import FeatureEmailComposer from "@/components/dashboard/FeatureEmailComposer";
import { listFeatureEmailHistory } from "@/lib/organizations/featureEmails";

export const metadata = { title: "Impact Cycles — Devometrics" };

export default async function ImpactCyclesPage() {
  const t = await getTranslations("companyImpactCyclesPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const { cycles, error } = await listReviewCycles();

  // Isolated from buildCompanyData's main query — a small, feature-specific
  // field not worth adding to that already-large shared aggregate. Degrades
  // to the default (1 = direct manager only) if migration 0082 hasn't run.
  let escalationLevels = 1;
  if (!error && data.organizationId) {
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("review_escalation_levels")
      .eq("id", data.organizationId)
      .maybeSingle<{ review_escalation_levels: number | null }>();
    escalationLevels = org?.review_escalation_levels ?? 1;
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div className="dashboard-wide-content">
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 680 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="performanceReviews" />

        {data.organizationId && <EscalatedReviewsWidget items={await getEscalatedReviews(data.organizationId)} />}

        {data.organizationId && (
          <FeatureEmailComposer
            organizationId={data.organizationId}
            featureKey="performance_review"
            employees={data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email, department: r.department }))}
            initialHistory={await listFeatureEmailHistory(data.organizationId, "performance_review")}
          />
        )}

        {error ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("notEnabledYet", {
                code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code>,
              })}
            </p>
          </div>
        ) : (
          <WorkflowSection organizationId={data.organizationId!} escalationLevels={escalationLevels} cycles={cycles} />
        )}
      </div>
    </div>
  );
}

async function WorkflowSection({
  organizationId,
  escalationLevels,
  cycles,
}: {
  organizationId: string;
  escalationLevels: number;
  cycles: Awaited<ReturnType<typeof listReviewCycles>>["cycles"];
}) {
  const [templateResult, organizationCompetencies] = await Promise.all([
    getOrCreateDefaultWorkflowTemplate(organizationId),
    listOrganizationCompetencies(organizationId),
  ]);

  return (
    <>
      <EscalationLevelsSetting organizationId={organizationId} initialLevels={escalationLevels} />
      {"error" in templateResult ? null : (
        <div style={{ marginTop: 20 }}>
          <PerformanceReviewWorkflowEditor
            templateId={templateResult.template.id}
            initialSteps={templateResult.steps}
            organizationCompetencyOptions={organizationCompetencies.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      )}
      <div style={{ marginTop: 20 }}>
        <PerformanceReviewsManager initialCycles={cycles} organizationId={organizationId} />
      </div>
    </>
  );
}
