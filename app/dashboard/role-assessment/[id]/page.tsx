import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleAssessment } from "@/lib/assessment/actions";
import RoleAssessmentScreen from "@/components/assessment/RoleAssessmentScreen";

export const metadata = { title: "Role assessment — Devometrics" };
// Scoring runs one competency at a time from this page; allow time for the model calls.
export const maxDuration = 120;

export default async function RoleAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("roleAssessment");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const view = await getRoleAssessment(id);
  if ("error" in view) notFound();
  const back = view.viewer === "employee" ? "/dashboard/role-assessment" : view.viewer === "admin" ? "/dashboard/company/role-assessments" : "/dashboard/my-team/role-assessments";

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link href={back} style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
          {t("back")}
        </Link>
        <div style={{ marginTop: 12 }}>
          <RoleAssessmentScreen view={view} />
        </div>
      </div>
    </div>
  );
}
