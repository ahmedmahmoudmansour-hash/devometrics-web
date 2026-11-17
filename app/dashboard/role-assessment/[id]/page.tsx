import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleAssessment } from "@/lib/assessment/actions";
import { getIntegrity, getIntegrityFor } from "@/lib/integrity/actions";
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
  const open = view.status === "assigned" || view.status === "in_progress";
  // The person answering gets the clock and the promise screen; anyone allowed to see the result sees how it was taken.
  const integrity = view.viewer === "employee" && open ? await getIntegrity("role", id) : { available: false, row: null, serverNow: 0 };
  const integrityRow = await getIntegrityFor("role", id, view.employeeUserId);
  const back = view.viewer === "employee" ? "/dashboard/role-assessment" : view.viewer === "admin" ? "/dashboard/company/role-assessments" : "/dashboard/my-team/role-assessments";

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Link href={back} className="no-print" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
          {t("back")}
        </Link>
        <div style={{ marginTop: 12 }}>
          <RoleAssessmentScreen view={view} integrity={integrity} integrityRow={integrityRow} />
        </div>
      </div>
    </div>
  );
}
