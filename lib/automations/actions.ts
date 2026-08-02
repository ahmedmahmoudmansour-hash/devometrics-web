"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RECIPES, type RecipeKey } from "./catalog";

export async function getAutomationSettings(organizationId: string): Promise<Record<RecipeKey, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_automation_settings")
    .select("recipe_key, enabled")
    .eq("organization_id", organizationId)
    .returns<{ recipe_key: RecipeKey; enabled: boolean }[]>();

  const byKey = new Map((data ?? []).map((r) => [r.recipe_key, r.enabled]));
  const result = {} as Record<RecipeKey, boolean>;
  for (const r of RECIPES) result[r.key] = byKey.get(r.key) ?? false;
  return result;
}

export async function updateAutomationSetting(organizationId: string, recipeKey: RecipeKey, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("workflow_automation_settings")
    .upsert(
      { organization_id: organizationId, recipe_key: recipeKey, enabled, updated_at: new Date().toISOString() },
      { onConflict: "organization_id,recipe_key" }
    );
  if (error) return { error: "Could not update — the database may need migration 0097 run first." };

  revalidatePath("/dashboard/company");
  return { success: true };
}
