import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getOrCreateDefaultOnboardingTemplate } from "@/lib/onboarding/actions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import OnboardingTemplateEditor from "@/components/dashboard/OnboardingTemplateEditor";
import type { KnowledgeHubContent } from "@/lib/supabase/types";

export const metadata = { title: "Onboarding — Devometrics" };

export default async function CompanyOnboardingPage() {
  const t = await getTranslations("companyOnboardingPage");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) redirect("/dashboard");

  const [templateResult, kbContent] = await Promise.all([
    getOrCreateDefaultOnboardingTemplate(data.organizationId),
    (async () => {
      const supabase = await createClient();
      const { data: content } = await supabase
        .from("knowledge_hub_content")
        .select("id, title, archived_at")
        .eq("organization_id", data.organizationId as string)
        .returns<Pick<KnowledgeHubContent, "id" | "title" | "archived_at">[]>();
      return (content ?? []).filter((c) => !c.archived_at);
    })(),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>{t("description")}</p>
        </div>

        <CompanyNavTabs active="onboarding" />

        {"error" in templateResult ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {t.rich("notEnabledYet", {
                code: (chunks) => <code style={{ color: "var(--teal)" }}>{chunks}</code>,
              })}
            </p>
          </div>
        ) : (
          <OnboardingTemplateEditor
            templateId={templateResult.template.id}
            initialSteps={templateResult.steps}
            knowledgeHubOptions={kbContent.map((c) => ({ id: c.id, title: c.title }))}
          />
        )}
      </div>
    </div>
  );
}
