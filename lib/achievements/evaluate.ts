"use server";

import { createClient } from "@/lib/supabase/server";
import type { AchievementKey } from "./catalog";

export type AchievementSignals = {
  hasAssessment: boolean;
  hasGapAnalysis: boolean;
  hasPlan: boolean;
  hasCompletedMilestone: boolean;
  hasResume: boolean;
  hasCompletedTask: boolean;
  currentStreak: number;
};

function qualifyingKeys(signals: AchievementSignals): AchievementKey[] {
  const keys: AchievementKey[] = [];
  if (signals.hasAssessment) keys.push("first_assessment");
  if (signals.hasGapAnalysis) keys.push("first_gap_analysis");
  if (signals.hasPlan) keys.push("first_plan");
  if (signals.hasCompletedMilestone) keys.push("first_milestone_completed");
  if (signals.hasResume) keys.push("resume_checked");
  if (signals.hasCompletedTask) keys.push("first_task_completed");
  if (signals.currentStreak >= 7) keys.push("streak_7");
  if (signals.currentStreak >= 30) keys.push("streak_30");
  return keys;
}

// Takes signals the dashboard page already computed from its own queries —
// no extra reads beyond user_achievements itself. Newly-qualifying keys are
// inserted; the (user_id, achievement_key) unique constraint makes re-runs
// harmless even under a race between two concurrent loads.
export async function syncAchievements(signals: AchievementSignals): Promise<AchievementKey[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: existing } = await supabase
    .from("user_achievements")
    .select("achievement_key")
    .eq("user_id", user.id);

  const existingKeys = new Set((existing ?? []).map((r) => r.achievement_key as AchievementKey));
  const toAward = qualifyingKeys(signals).filter((k) => !existingKeys.has(k));

  if (toAward.length > 0) {
    await supabase
      .from("user_achievements")
      .insert(toAward.map((achievement_key) => ({ user_id: user.id, achievement_key })));
  }

  return [...existingKeys, ...toAward];
}
