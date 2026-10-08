"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/organizations/timezones";

// organizations.timezone (0192): the clock attendance uses for this company.
export async function getOrganizationTimezone(organizationId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .maybeSingle<{ timezone: string | null }>();
  return data?.timezone && isValidTimezone(data.timezone) ? data.timezone : DEFAULT_TIMEZONE;
}

export async function setOrganizationTimezone(organizationId: string, timezone: string): Promise<{ error: string } | { success: true }> {
  if (!isValidTimezone(timezone)) return { error: "Choose a valid timezone" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ timezone }).eq("id", organizationId).select("id");
  if (error) {
    console.error("setOrganizationTimezone failed:", error);
    return { error: "Could not save — the database may need migration 0192 run first." };
  }
  if (!data || data.length === 0) return { error: "Only a company admin can change this." };
  revalidatePath("/dashboard/company/settings");
  revalidatePath("/dashboard/leave");
  return { success: true };
}
