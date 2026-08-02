import type { createClient } from "@/lib/supabase/server";
import type { RecipeKey } from "./catalog";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function isRecipeEnabled(supabase: SupabaseServerClient, organizationId: string, recipeKey: RecipeKey): Promise<boolean> {
  const { data } = await supabase
    .from("workflow_automation_settings")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("recipe_key", recipeKey)
    .maybeSingle<{ enabled: boolean }>();
  return data?.enabled ?? false;
}

// subjectUserId is always the person the automation is ABOUT, and — per
// the insert policy in migration 0097 — must equal the caller's own
// auth.uid() (every recipe fires from within that person's own request,
// e.g. saving their own assessment result), never a different user.
export async function logAutomation(
  supabase: SupabaseServerClient,
  params: { organizationId: string; recipeKey: RecipeKey; subjectUserId: string; summary: string }
): Promise<void> {
  try {
    await supabase.from("workflow_automation_log").insert({
      organization_id: params.organizationId,
      recipe_key: params.recipeKey,
      subject_user_id: params.subjectUserId,
      summary: params.summary,
    });
  } catch (err) {
    console.error("logAutomation failed (non-fatal):", err);
  }
}

// Has this exact recipe already fired for this person within `days`? Used
// by high_potential_to_succession to avoid re-emailing a manager every
// single time the same already-flagged person reruns their Gap Analysis.
export async function firedRecently(
  supabase: SupabaseServerClient,
  params: { organizationId: string; recipeKey: RecipeKey; subjectUserId: string; days: number }
): Promise<boolean> {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("workflow_automation_log")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("recipe_key", params.recipeKey)
    .eq("subject_user_id", params.subjectUserId)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle<{ id: string }>();
  return !!data;
}
