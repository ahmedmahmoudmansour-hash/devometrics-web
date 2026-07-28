import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getAssessment, assessmentDisplayName, assessmentDisplayDescription } from "@/lib/assessments/catalog";
import AssessmentForm from "@/components/dashboard/AssessmentForm";
import type { Profile } from "@/lib/supabase/types";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const assessment = getAssessment(slug);
  if (!assessment) notFound();
  const t = await getTranslations("assessmentPage");
  const tCatalog = await getTranslations("assessmentCatalog");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("career_stage")
    .eq("id", user.id)
    .single<Pick<Profile, "career_stage">>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/assessments" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToAll")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {assessmentDisplayName(tCatalog, assessment.slug)}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {assessmentDisplayDescription(tCatalog, assessment.slug)}
          </p>
        </div>
        <AssessmentForm assessment={assessment} careerStage={profile?.career_stage ?? null} />
      </div>
    </div>
  );
}
