"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENTS, scoreToBand } from "@/lib/assessments/catalog";
import { getDefaultAction } from "@/lib/gap-analysis/actionLibrary";
import { applyAccommodation, type Accommodation } from "@/lib/gap-analysis/accommodations";
import { freeResourceNote, showsFreeAlternative, type ResourceTier } from "@/lib/gap-analysis/freeResources";
import { bookRecommendationNote } from "@/lib/gap-analysis/bookRecommendations";
import { resourceSearchNote } from "@/lib/gap-analysis/resourceSearch";
import {
  cadenceLabelForHorizon,
  periodHours,
  budgetNote,
  targetWeekOffset,
  gapCountForHorizon,
  type Horizon,
} from "@/lib/gap-analysis/horizons";
import type { AssessmentResult, Profile } from "@/lib/supabase/types";

function targetDateWeeksFromNow(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// Individual PDP generated from Assessment Center results rather than a gap
// analysis: ranks completed assessments by weakest score, then builds
// milestones using the same dimension-mapped, per-format action library and
// real book recommendations as the Gap Analysis plan generator — not a
// separate, more generic content system. Each assessment maps to one of the
// 8 fixed competency dimensions (see catalog.ts), which is what lets this
// reuse getDefaultAction instead of the old static score-band phrasing.
export async function generatePlanFromAssessments(horizon: Horizon) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: results } = await supabase
    .from("assessment_results")
    .select("*")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .returns<AssessmentResult[]>();

  if (!results || results.length === 0) {
    return { error: "Complete at least one assessment first." };
  }

  const latestBySlug = new Map<string, AssessmentResult>();
  for (const r of results) {
    if (!latestBySlug.has(r.assessment_slug)) latestBySlug.set(r.assessment_slug, r);
  }

  const weakest = Array.from(latestBySlug.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, gapCountForHorizon(horizon));

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const tier = (profile?.resource_tier as ResourceTier | null) ?? null;
  const accommodation = (profile?.accommodation as Accommodation) ?? null;

  const { data: plan } = await supabase
    .from("development_plans")
    .insert({ user_id: user.id, title: "Personal Development Plan", horizon })
    .select()
    .single();
  if (!plan) return { error: "Could not create plan" };

  const milestones = weakest.map((r, i) => {
    const assessment = ASSESSMENTS.find((a) => a.slug === r.assessment_slug);
    const name = assessment?.name ?? r.assessment_slug;
    const band = scoreToBand(r.score);
    const dimension = assessment?.dimension ?? "Critical Thinking";
    const action = getDefaultAction(dimension, r.score, profile?.learning_preferences ?? null);

    const freeNote = showsFreeAlternative(tier) ? ` ${freeResourceNote(dimension)}` : "";
    const searchNote = resourceSearchNote(dimension, action.format, profile?.location ?? null);
    const description = `${band.interpretation(name)} ${action.description}${freeNote}${searchNote ? ` ${searchNote}` : ""} ${bookRecommendationNote(dimension)}`;
    const base = { title: `${name}: ${band.label} → Proficient — ${action.title}`, description };
    const final = applyAccommodation(base, accommodation);

    return {
      plan_id: plan.id,
      title: final.title,
      description: final.description,
      position: i,
      target_date: targetDateWeeksFromNow(targetWeekOffset(horizon, i, weakest.length)),
      weekly_hours: periodHours(action.format, horizon),
      hours_period: cadenceLabelForHorizon(horizon),
      budget_note: budgetNote(action.format, tier),
      success_indicator: `You can point to one concrete example of ${name.toLowerCase()} improvement — a specific situation, not just a higher self-rating.`,
    };
  });

  if (milestones.length) {
    await supabase.from("milestones").insert(milestones);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/assessments");
  return { success: true, planId: plan.id as string };
}
