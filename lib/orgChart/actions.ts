"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { wouldCreateCycle } from "@/lib/orgChart/tree";

// Reassigns who someone reports to — the one write the Org Chart Builder
// makes. Three checks before it ever touches the database: not
// self-management, the proposed manager is actually a member of the same
// org (defense in depth beyond RLS), and the assignment wouldn't create a
// reporting loop anywhere in the chain.
export async function setMemberManager(employeeUserId: string, managerUserId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };

  if (managerUserId === employeeUserId) {
    return { error: "Someone can't be their own manager." };
  }

  if (managerUserId) {
    const isMember = data.rows.some((r) => r.userId === managerUserId);
    if (!isMember) return { error: "That person isn't a member of your organization." };

    const managerByUserId = new Map(data.rows.map((r) => [r.userId, r.managerUserId]));
    if (wouldCreateCycle(employeeUserId, managerUserId, managerByUserId)) {
      return {
        error: "That would create a reporting loop — this person is already, directly or indirectly, managed by the person you're assigning.",
      };
    }
  }

  const previousManagerUserId = data.rows.find((r) => r.userId === employeeUserId)?.managerUserId ?? null;

  const { error } = await supabase
    .from("organization_members")
    .update({ manager_user_id: managerUserId })
    .eq("organization_id", data.organizationId)
    .eq("user_id", employeeUserId);
  if (error) {
    console.error("setMemberManager failed:", error);
    return { error: "Could not update — the database may need migration 0072 run first." };
  }

  // Phase 1 of the retention/Flight Risk roadmap — a manager change is a
  // real, meaningful signal on its own (frequent manager churn correlates
  // with attrition), logged here rather than reconstructed later.
  if (previousManagerUserId !== managerUserId) {
    await supabase.from("employee_role_change_history").insert({
      organization_id: data.organizationId,
      employee_user_id: employeeUserId,
      field: "manager",
      old_value: previousManagerUserId,
      new_value: managerUserId,
      changed_by: user.id,
    });
  }

  revalidatePath("/dashboard/company/org-chart");
  revalidatePath("/dashboard/company/employees");
  return { success: true };
}
