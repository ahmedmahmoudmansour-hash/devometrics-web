import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_STEP_DEFS } from "./onboardingSteps";

export type NextOnboardingStep = { labelKey: string; href: string } | null;

// Existence-only lookups (id or count, never a full row) — this runs on
// EVERY dashboard page load via app/dashboard/layout.tsx, not just the home
// page, so it deliberately stays as cheap as possible rather than reusing
// the home page's own richer queries (which fetch full rows because they
// feed other cards too — Career GPS, composite score, etc). Mirrors
// ONBOARDING_STEP_DEFS's order so this always agrees with the home page's
// full checklist about what's next.
export async function getNextOnboardingStep(): Promise<NextOnboardingStep> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: discovery }, { count: assessmentCount }, { data: analysis }, { count: planCount }, { data: resume }] =
    await Promise.all([
      supabase.from("discovery_profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase.from("assessment_results").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("gap_analyses").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase.from("development_plans").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("resume_analyses").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

  const done = [!!discovery, (assessmentCount ?? 0) > 0, !!analysis, (planCount ?? 0) > 0, !!resume];
  const nextIndex = done.findIndex((d) => !d);
  if (nextIndex === -1) return null;

  const def = ONBOARDING_STEP_DEFS[nextIndex];
  return { labelKey: def.labelKey, href: def.href };
}
