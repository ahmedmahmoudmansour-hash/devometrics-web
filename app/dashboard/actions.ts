"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPlan(title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("development_plans").insert({ user_id: user.id, title });
  revalidatePath("/dashboard");
}

export async function createMilestone(planId: string, title: string, position: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("milestones").insert({ plan_id: planId, title, position });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
}

export async function toggleMilestone(id: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("milestones")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
}

// Lets someone reword, reschedule, or add detail to an AI-generated
// milestone instead of treating it as fixed output — the plan should feel
// like theirs to shape, not a read-only report.
export async function updateMilestone(
  id: string,
  fields: { title: string; description: string | null; target_date: string | null; user_notes?: string | null }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!fields.title.trim()) return { error: "Title can't be empty" };

  const { error } = await supabase
    .from("milestones")
    .update({
      title: fields.title.trim(),
      description: fields.description?.trim() || null,
      target_date: fields.target_date || null,
      ...(fields.user_notes !== undefined ? { user_notes: fields.user_notes?.trim() || null } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
}

export async function deleteMilestone(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
}

export async function updatePlanTitle(planId: string, title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!title.trim()) return { error: "Title can't be empty" };

  const { error } = await supabase
    .from("development_plans")
    .update({ title: title.trim() })
    .eq("id", planId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
}

// Cascades to milestones via the existing on-delete-cascade FK — one
// delete, not a manual cleanup of the child rows first.
export async function deletePlan(planId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("development_plans").delete().eq("id", planId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
}

export async function updateProfile(
  location: string,
  learningPreferences: string[],
  careerStage: string,
  accommodation: string,
  resourceTier: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      location,
      learning_preferences: learningPreferences,
      career_stage: careerStage,
      accommodation,
      resource_tier: resourceTier,
    })
    .eq("id", user.id);
  revalidatePath("/dashboard");
}

export async function updateAvatarUrl(avatarUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

// Lighter than updateProfile — used by the inline "how do you want to
// learn?" step during plan creation, which shouldn't need to also touch
// location/career stage/accommodation/budget just to save this one field.
// Saving it here (not just using it for this one plan) means the choice
// sticks for next time too, instead of asking again on every plan.
export async function updateLearningPreferences(learningPreferences: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ learning_preferences: learningPreferences })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}

const VALID_COACH_VOICES = new Set(["off", "sarah", "theo", "megan", "jack"]);

// Persists which of the 4 Speechmatics voices (or "off") the Coach should
// narrate replies in, so the choice sticks across visits instead of
// resetting every session.
export async function updateCoachVoice(voice: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!VALID_COACH_VOICES.has(voice)) return { error: "Invalid voice" };

  const { error } = await supabase.from("profiles").update({ coach_voice: voice }).eq("id", user.id);
  if (error) return { error: "Could not save voice preference" };

  revalidatePath("/dashboard/coach");
  return { success: true };
}

// Lets someone opt out of the achievements/badges display entirely — some
// people find gamification patronizing rather than motivating, so this
// stays a persisted per-account choice, not just a session dismiss.
export async function updateBadgesEnabled(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("profiles").update({ badges_enabled: enabled }).eq("id", user.id);
  if (error) return { error: "Could not save — try again." };

  revalidatePath("/dashboard");
  return { success: true };
}

// Free-tier users saw the Upgrade/trial/student-discount cluster on every
// single visit to the home dashboard with no way to hide it — this is the
// one-way "hide this" a returning user reaches for once they've already
// seen the pitch. No "undo" surfaced in the UI (matches badges_enabled's
// simplicity), but nothing stops re-enabling it directly if ever needed.
export async function dismissUpgradePrompt() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("profiles").update({ upgrade_prompt_dismissed: true }).eq("id", user.id);
  if (error) return { error: "Could not save — try again." };

  revalidatePath("/dashboard");
  return { success: true };
}

// Persists the theme choice for logged-in users so it syncs across devices.
// No-op if not authenticated — localStorage + the data-theme attribute
// still handle the logged-out/public-page case on their own.
export async function updateTheme(theme: "dark" | "light") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ theme }).eq("id", user.id);
}

// Deletes all app data for the current user (plans, milestones via cascade,
// coach history, assessment results, gap analyses, resume/discovery/Big
// Five profiles, coach GROW memory, achievements, momentum snapshots,
// personal tasks, survey participation) and clears personal profile fields.
// Kept in sync with /api/account/export, which promises to surface the same
// set of tables — if you add a new user-data table, add it to both places.
// Grace period before a scheduled data deletion actually runs (see
// migration 0059's purge_scheduled_data_deletions, called daily by
// /api/cron/purge-deletions). Same window as organization deletion
// (lib/organizations/actions.ts DELETION_GRACE_DAYS).
const DATA_DELETION_GRACE_DAYS = 30;

// No longer deletes immediately — schedules it. Every plan, coach
// message, assessment result, etc. stays completely intact and the
// account keeps working normally until the grace period lapses; only the
// actual purge (in the cron-triggered SQL function) permanently removes
// anything. Does not delete the login itself — that requires a
// service_role key we deliberately don't hold; contact support for full
// account deletion.
export async function deleteMyData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const deletionAt = new Date(Date.now() + DATA_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ pending_data_deletion_at: deletionAt })
    .eq("id", user.id);
  if (error) return { error: "Could not schedule deletion — try again" };

  revalidatePath("/dashboard");
  return { success: true, deletionAt };
}

export async function cancelMyDataDeletion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("profiles").update({ pending_data_deletion_at: null }).eq("id", user.id);
  if (error) return { error: "Could not cancel — try again" };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
