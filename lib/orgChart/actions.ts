"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { wouldCreateCycle } from "@/lib/orgChart/tree";
import { buildMergedManagerEdgeMap, memberTag, positionTag } from "@/lib/orgChart/mergedTree";
import { listPositions, listMemberManagerPositions, type OrgPositionRow } from "@/lib/orgChart/positions";

// Reassigns who someone reports to — the one write the Org Chart Builder
// makes. Three checks before it ever touches the database: not
// self-management, the proposed manager is actually a member of the same
// org (defense in depth beyond RLS), and the assignment wouldn't create a
// reporting loop anywhere in the chain.
export async function setMemberManager(
  employeeUserId: string,
  managerUserId: string | null
): Promise<{ success: true } | { error: string }> {
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
    // manager_position_id is nulled alongside manager_user_id — the two
    // columns are mutually exclusive (migration 0106's check constraint):
    // if this employee previously reported to a vacant position, dragging
    // them onto a real employee's card must clear that pointer or the
    // write fails the constraint. A no-op for the common case where it was
    // never set.
    .update({ manager_user_id: managerUserId, manager_position_id: null })
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

// Loads what the merged-tree cycle check needs — live positions and which
// members currently report to a vacant position — given rows the caller
// already fetched, so setMemberManagerPosition/setPositionParent below
// don't each trigger a second buildCompanyData() round trip.
async function loadMergedEdgeInputs(rows: Awaited<ReturnType<typeof buildCompanyData>>["rows"]) {
  const [positions, memberManagerPositions] = await Promise.all([listPositions(), listMemberManagerPositions()]);
  return { positions, memberManagerPositions, edgeMap: buildMergedManagerEdgeMap(rows, positions, memberManagerPositions) };
}

// The position-side counterpart to setMemberManager: reassigns a real
// employee to report to a vacant/structural position instead of a real
// person. Same three-check posture (not authorized / not a member of this
// org / wouldn't create a cycle), just walked over the merged member+
// position edge map instead of the real-only one.
export async function setMemberManagerPosition(
  employeeUserId: string,
  positionId: string | null
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };

  const rows = data.rows;
  const { positions, memberManagerPositions, edgeMap } = await loadMergedEdgeInputs(rows);

  if (positionId) {
    const targetPosition: OrgPositionRow | undefined = positions.find((p) => p.id === positionId);
    if (!targetPosition) return { error: "That position isn't part of your organization's chart." };

    if (wouldCreateCycle(memberTag(employeeUserId), positionTag(positionId), edgeMap)) {
      return {
        error: "That would create a reporting loop — this position is already, directly or indirectly, managed by the person you're assigning.",
      };
    }
  }

  const previousRow = rows.find((r) => r.userId === employeeUserId);
  const previousManagerPositionId = memberManagerPositions.get(employeeUserId) ?? null;
  const previousValue = previousManagerPositionId ? positionTag(previousManagerPositionId) : previousRow?.managerUserId ?? null;
  const newValue = positionId ? positionTag(positionId) : null;

  const { error } = await supabase
    .from("organization_members")
    .update({ manager_user_id: null, manager_position_id: positionId })
    .eq("organization_id", data.organizationId)
    .eq("user_id", employeeUserId);
  if (error) {
    console.error("setMemberManagerPosition failed:", error);
    return { error: "Could not update — the database may need migration 0106 run first." };
  }

  if (previousValue !== newValue) {
    await supabase.from("employee_role_change_history").insert({
      organization_id: data.organizationId,
      employee_user_id: employeeUserId,
      field: "manager",
      old_value: previousValue,
      new_value: newValue,
      changed_by: user.id,
    });
  }

  revalidatePath("/dashboard/company/org-chart");
  revalidatePath("/dashboard/company/employees");
  return { success: true };
}

// Reassigns a position's own parent — the drag-and-drop write path for
// moving a vacant/structural node under another position or a real
// employee. Cycle-checked the same way as the two functions above.
export async function setPositionParent(
  positionId: string,
  newParentPositionId: string | null,
  newParentMemberUserId: string | null
): Promise<{ success: true } | { error: string }> {
  if (newParentPositionId && newParentMemberUserId) {
    return { error: "A position can report to another position or an employee, not both." };
  }
  if (newParentPositionId === positionId) {
    return { error: "A position can't report to itself." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };

  const { edgeMap } = await loadMergedEdgeInputs(data.rows);

  const targetTag = newParentPositionId ? positionTag(newParentPositionId) : newParentMemberUserId ? memberTag(newParentMemberUserId) : null;
  if (targetTag && wouldCreateCycle(positionTag(positionId), targetTag, edgeMap)) {
    return {
      error: "That would create a reporting loop — that node is already, directly or indirectly, positioned under this one.",
    };
  }

  const { error } = await supabase
    .from("org_positions")
    .update({ parent_position_id: newParentPositionId, parent_member_user_id: newParentMemberUserId, updated_at: new Date().toISOString() })
    .eq("id", positionId)
    .eq("organization_id", data.organizationId);
  if (error) {
    console.error("setPositionParent failed:", error);
    return { error: "Could not move this position — the database may need migration 0106 run first." };
  }

  revalidatePath("/dashboard/company/org-chart");
  return { success: true };
}
