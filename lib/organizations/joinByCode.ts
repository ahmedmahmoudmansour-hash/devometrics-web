"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// organizations.join_by_code_enabled (0190). OFF by default: the company
// code is a shared secret (company name + 4 random characters, no rate
// limit), so it only works for companies whose admin has switched it on.
// Email invites are the recommended way to add people.
export async function getJoinByCodeEnabled(organizationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("join_by_code_enabled")
    .eq("id", organizationId)
    .maybeSingle<{ join_by_code_enabled: boolean | null }>();
  return !!data?.join_by_code_enabled;
}

export async function setJoinByCodeEnabled(organizationId: string, enabled: boolean): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ join_by_code_enabled: enabled }).eq("id", organizationId).select("id");
  if (error) {
    console.error("setJoinByCodeEnabled failed:", error);
    return { error: "Could not save this setting — the database may need migration 0190 run first." };
  }
  if (!data || data.length === 0) return { error: "Only a company admin can change this." };
  revalidatePath("/dashboard/company/settings");
  revalidatePath("/dashboard/company");
  return { success: true };
}
