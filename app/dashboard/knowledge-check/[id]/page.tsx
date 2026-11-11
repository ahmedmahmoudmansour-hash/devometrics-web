import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getKnowledgeCheck } from "@/lib/knowledgeBank/actions";
import KnowledgeCheckForm from "@/components/knowledgeCheck/KnowledgeCheckForm";
import KnowledgeCheckResult from "@/components/knowledgeCheck/KnowledgeCheckResult";

export const metadata = { title: "Knowledge check — Devometrics" };

export default async function KnowledgeCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("knowledgeCheck");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const page = await getKnowledgeCheck(id);
  const back = "kind" in page && page.kind === "result" && !page.ownCheck ? "/dashboard/my-team/role-assessments" : "/dashboard/role-assessment";

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link href={back} className="no-print" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
          {t("back")}
        </Link>
        <div style={{ marginTop: 12 }}>
          {"error" in page ? (
            <p role="alert" style={{ color: "var(--danger)", fontSize: 14 }}>
              {page.error}
            </p>
          ) : page.kind === "take" ? (
            <KnowledgeCheckForm view={page.view} />
          ) : page.kind === "result" ? (
            <KnowledgeCheckResult view={page.view} employeeName={page.employeeName} />
          ) : (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>{page.roleTitle}</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 10 }}>{t("pendingFor", { name: page.employeeName ?? "—" })}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
