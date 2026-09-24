"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { SWITCHABLE_FEATURE_KEYS } from "@/lib/organizations/companyTiles";

// Switched-off company features for the CURRENT user's company (0179). Any
// member can read it (organizations is member-readable); it drives what the
// hub and nav tabs show. Degrades to "everything on" if the column doesn't
// exist yet or the lookup fails, so a missing migration never hides pages.
export async function getMyDisabledCompanyFeatures(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getMyOrganizationId(supabase, user.id);
  if (!organizationId) return [];
  const { data } = await supabase
    .from("organizations")
    .select("disabled_company_features")
    .eq("id", organizationId)
    .maybeSingle<{ disabled_company_features: string[] | null }>();
  return data?.disabled_company_features ?? [];
}

// Admin-only via organizations' existing is_org_admin UPDATE policy (same
// path as setDirectoryEnabled). Locked features and unknown keys are dropped
// here, so a crafted request can't switch off Settings or its own switches.
export async function setDisabledCompanyFeatures(organizationId: string, keys: string[]): Promise<{ error: string } | { success: true }> {
  const allowed = new Set<string>(SWITCHABLE_FEATURE_KEYS);
  const clean = [...new Set(keys)].filter((k) => allowed.has(k));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ disabled_company_features: clean })
    .eq("id", organizationId)
    .select("id");
  if (error) {
    console.error("setDisabledCompanyFeatures failed:", error);
    return { error: "Could not save — the database may need migration 0179 run first." };
  }
  if (!data || data.length === 0) return { error: "Only a company admin can change this." };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
