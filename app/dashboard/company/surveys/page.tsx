import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listOrgSurveys } from "@/lib/surveys/actions";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import SurveyBuilder from "@/components/dashboard/SurveyBuilder";
import SurveyResultsCard from "@/components/dashboard/SurveyResultsCard";

export default async function CompanySurveysPage() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const surveys = await listOrgSurveys();
  const employees = data.rows.map((r) => ({ userId: r.userId, name: r.name }));

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {data.organizationName}
          </h1>
        </div>

        <CompanyNavTabs active="surveys" />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {employees.length === 0 ? (
            <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Invite your team from the{" "}
                <Link href="/dashboard/company" style={{ color: "var(--teal)" }}>
                  Profile
                </Link>{" "}
                tab before creating a survey — there&apos;s no one to assign it to yet.
              </p>
            </div>
          ) : (
            <SurveyBuilder employees={employees} />
          )}

          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
              Your surveys
            </h2>
            {surveys.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No surveys created yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {surveys.map((s) => (
                  <SurveyResultsCard key={s.id} survey={s} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
