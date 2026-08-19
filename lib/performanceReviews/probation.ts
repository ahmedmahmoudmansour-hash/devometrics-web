"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAutomatedSingleEmployeeCycle } from "./cycleAutomation";
import { sendProbationReadyAlert } from "@/lib/automations/recipes";

// Admin-facing manual trigger — covers the case an invite didn't have "This
// is a new hire" checked (migration 0129), or an existing employee is only
// later identified as needing a probation review. Reuses the exact same RPC
// + notification path as the automated hire_to_probation recipe, so the
// resulting review is identically gated (hidden from the employee until
// their manager accepts it) — not a second, differently-behaved mechanism.
// Only reachable from the employee detail page, which is already
// org-admin-gated (buildEmployeeDetail's isAuthorized); the RPC's own
// is_org_admin check is still the real authorization boundary.
export async function startProbationReview(employeeUserId: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, manager_user_id")
    .eq("user_id", employeeUserId)
    .maybeSingle<{ organization_id: string; manager_user_id: string | null }>();
  if (!member) return { error: "Employee not found" };

  // Avoid silently creating a second probation review for someone who
  // already has one open (unaccepted or in progress).
  const { data: existing } = await supabase
    .from("performance_reviews")
    .select("id")
    .eq("employee_user_id", employeeUserId)
    .eq("requires_hiring_manager_acceptance", true)
    .neq("status", "closed")
    .limit(1);
  if (existing && existing.length > 0) {
    return { error: "This employee already has an active probation review." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", employeeUserId)
    .maybeSingle<{ full_name: string | null }>();
  const employeeName = profile?.full_name ?? "Employee";

  const result = await createAutomatedSingleEmployeeCycle(supabase, {
    employeeUserId,
    starterKey: "probation_review",
    cycleName: `${employeeName} — Probation Review`,
  });
  if ("error" in result) return result;

  if (member.manager_user_id) {
    const { data: managerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", member.manager_user_id)
      .maybeSingle<{ email: string | null }>();
    if (managerProfile?.email) {
      await sendProbationReadyAlert(supabase, {
        organizationId: member.organization_id,
        employeeName,
        managerEmail: managerProfile.email,
      });
    }
  }

  revalidatePath(`/dashboard/company/${employeeUserId}`);
  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}
