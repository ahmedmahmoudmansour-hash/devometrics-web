"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";

// Calls reset_org_chart (migration 0121) — an atomic RPC rather than a
// client-side loop specifically so a failure can't leave the chart
// half-reset. The RPC does its own is_org_admin check (RLS is bypassed
// inside a SECURITY DEFINER function) — this app-layer check is a
// friendlier early error, not the real authorization boundary.
export async function resetOrgChart(): Promise<{ success: true } | { error: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_org_chart", { target_organization_id: data.organizationId });
  if (error) {
    console.error("resetOrgChart failed:", error);
    return { error: "Could not reset — the database may need migration 0121 run first." };
  }

  revalidatePath("/dashboard/company/org-chart");
  revalidatePath("/dashboard/company/employees");
  return { success: true };
}
