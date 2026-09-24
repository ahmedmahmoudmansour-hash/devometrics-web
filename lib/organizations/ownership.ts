"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Workspace ownership — a broader governance concept than Compensation
// Admin (compensationAccess.ts), even though it currently exists mainly to
// gate who controls that. owner_user_id (migration 0162) is the live,
// transferable pointer; organizations.created_by stays an untouched
// historical fact. See 0162's own header for why this is a two-step
// propose/accept flow rather than an instant handoff.

export type OwnershipInfo = {
  ownerId: string;
  ownerName: string | null;
  pendingOwnerId: string | null;
  pendingOwnerName: string | null;
  pendingProposedAt: string | null;
};

export async function getOrgOwnershipInfo(organizationId: string): Promise<OwnershipInfo | null> {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("owner_user_id, created_by, pending_owner_id, pending_owner_proposed_at")
    .eq("id", organizationId)
    .maybeSingle<{ owner_user_id: string | null; created_by: string; pending_owner_id: string | null; pending_owner_proposed_at: string | null }>();
  if (!org) return null;

  const ownerId = org.owner_user_id ?? org.created_by;
  const idsToLookUp = [ownerId, ...(org.pending_owner_id ? [org.pending_owner_id] : [])];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", idsToLookUp)
    .returns<{ id: string; full_name: string | null; email: string }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]));

  return {
    ownerId,
    ownerName: nameById.get(ownerId) ?? null,
    pendingOwnerId: org.pending_owner_id,
    pendingOwnerName: org.pending_owner_id ? nameById.get(org.pending_owner_id) ?? null : null,
    pendingProposedAt: org.pending_owner_proposed_at,
  };
}

// Current owner only (enforced by is_org_owner() inside the RPC) — the
// target must already be an org admin, checked server-side in the RPC too,
// not just here.
export async function proposeOwnershipTransfer(organizationId: string, newOwnerUserId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_ownership_transfer", { check_org_id: organizationId, new_owner_user_id: newOwnerUserId });
  if (error) {
    console.error("proposeOwnershipTransfer failed:", error);
    const message = error.message?.includes("must already be an admin")
      ? "The new owner must already be an admin of this organization"
      : error.message?.includes("Already the owner")
        ? "This person is already the owner"
        : "Could not propose this transfer — the database may need migration 0162 run first.";
    return { error: message };
  }

  revalidatePath("/dashboard/company/permissions");
  return { success: true };
}

export async function cancelOwnershipTransfer(organizationId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_ownership_transfer", { check_org_id: organizationId });
  if (error) {
    console.error("cancelOwnershipTransfer failed:", error);
    return { error: "Could not cancel this transfer" };
  }

  revalidatePath("/dashboard/company/permissions");
  return { success: true };
}

// Only the proposed new owner can call this successfully — enforced inside
// the RPC (accept_ownership_transfer checks pending_owner_id = auth.uid()).
export async function acceptOwnershipTransfer(organizationId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_ownership_transfer", { check_org_id: organizationId });
  if (error) {
    console.error("acceptOwnershipTransfer failed:", error);
    return { error: "No pending ownership transfer to you for this organization" };
  }

  revalidatePath("/dashboard/company/permissions");
  return { success: true };
}
