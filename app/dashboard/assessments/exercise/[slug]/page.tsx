import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCaseStudyExercise, localizeCaseStudyExercise } from "@/lib/assessments/caseStudyExercises";
import ExerciseAttempt from "@/components/dashboard/ExerciseAttempt";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { hasOrganizationMembership } from "@/lib/organizations/membership";
import type { LevelSection } from "@/lib/assessments/catalog";
import type { Profile } from "@/lib/supabase/types";

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rawExercise = getCaseStudyExercise(slug);
  if (!rawExercise) notFound();
  const t = await getTranslations("exercisePage");
  const tExercise = await getTranslations("caseStudyExercises");
  const tSections = await getTranslations("assessmentsPage");
  const SECTION_LABEL: Record<LevelSection, string> = {
    Foundational: tSections("sectionFoundationalLabel"),
    Professional: tSections("sectionProfessionalLabel"),
    Leadership: tSections("sectionLeadershipLabel"),
    Executive: tSections("sectionExecutiveLabel"),
  };
  const exercise = localizeCaseStudyExercise(rawExercise, tExercise);
  const levelLabel = SECTION_LABEL[rawExercise.level];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, hasOrgMembership] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    hasOrganizationMembership(supabase, user.id),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/assessments" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToAssessmentCenter")}
          </Link>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null, hasOrgMembership)}
          feature={t("premiumFeatureName")}
          description={t("premiumFeatureDescription")}
        >
          <ExerciseAttempt exercise={exercise} levelLabel={levelLabel} />
        </PremiumGate>
      </div>
    </div>
  );
}
