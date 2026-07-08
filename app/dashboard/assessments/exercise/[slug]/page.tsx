import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCaseStudyExercise } from "@/lib/assessments/caseStudyExercises";
import ExerciseAttempt from "@/components/dashboard/ExerciseAttempt";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type { Profile } from "@/lib/supabase/types";

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exercise = getCaseStudyExercise(slug);
  if (!exercise) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/assessments" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Assessment Center
          </Link>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null)}
          feature="Timed case-study exercise"
          description="A realistic, timed scenario with AI-graded feedback on your response — upgrade to Premium to attempt it."
        >
          <ExerciseAttempt exercise={exercise} />
        </PremiumGate>
      </div>
    </div>
  );
}
