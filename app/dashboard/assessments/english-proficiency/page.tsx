import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import EnglishProficiencyForm from "@/components/dashboard/EnglishProficiencyForm";
import SittingGate from "@/components/assessment/SittingGate";
import { hasOrganizationMembership } from "@/lib/organizations/membership";
import { ENGLISH_PROFICIENCY_SLUG, ENGLISH_PROFICIENCY_QUESTIONS } from "@/lib/assessments/englishProficiency";

export const metadata = { title: "English Proficiency — Devometrics" };

export default async function EnglishProficiencyPage() {
  const t = await getTranslations("englishProficiencyPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Only people in a company are recorded: that is who a manager can see. Individual accounts take the test as before.
  const inCompany = await hasOrganizationMembership(supabase, user.id);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/assessments" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToAll")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {t("subtitle")}
          </p>
        </div>
        {inCompany ? (
          <SittingGate kind="english" slug={ENGLISH_PROFICIENCY_SLUG} questionCount={ENGLISH_PROFICIENCY_QUESTIONS.length} serverNow={Date.now()}>
            {(onComplete) => <EnglishProficiencyForm onComplete={onComplete} />}
          </SittingGate>
        ) : (
          <EnglishProficiencyForm />
        )}
      </div>
    </div>
  );
}
