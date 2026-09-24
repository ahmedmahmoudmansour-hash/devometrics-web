"use server";

import { createClient } from "@/lib/supabase/server";

// Every access goes through list_employee_history() (0170) -- the RPC
// itself enforces self/admin/manager-with-visibility authorization and
// applies compensation's own manager_compensation_visibility() as a
// second gate on the band-change slice specifically. See 0170's header.

export type EmploymentHistoryEvent = {
  eventType: "joined" | "title_change" | "role_change" | "band_change" | "status_change";
  oldValue: string | null;
  newValue: string | null;
  effectiveAt: string;
};

type RawEvent = { event_type: string; old_value: string | null; new_value: string | null; effective_at: string };

// Returns [] on denial/not-found rather than throwing -- matches this
// codebase's "gated list returns [] on denial" convention (e.g.
// listOrgCompensation), so a caller who can't see it just sees an empty
// timeline instead of an error screen.
export async function getEmployeeHistory(targetUserId: string): Promise<EmploymentHistoryEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_employee_history", { target_user_id: targetUserId });
  if (error || !data) return [];
  const rows = data as RawEvent[];
  return rows.map((r) => ({
    eventType: r.event_type as EmploymentHistoryEvent["eventType"],
    oldValue: r.old_value,
    newValue: r.new_value,
    effectiveAt: r.effective_at,
  }));
}

// Same direct .from("organizations") pattern as compensation/leave's
// manager-visibility toggles (protected by the existing is_org_admin
// UPDATE policy on organizations).
export type EmploymentHistoryManagerVisibility = "visible" | "hidden";

export async function getEmploymentHistoryManagerVisibility(organizationId: string): Promise<EmploymentHistoryManagerVisibility> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("employment_history_manager_visibility")
    .eq("id", organizationId)
    .maybeSingle<{ employment_history_manager_visibility: string | null }>();
  return data?.employment_history_manager_visibility === "hidden" ? "hidden" : "visible";
}

export async function setEmploymentHistoryManagerVisibility(
  organizationId: string,
  visibility: EmploymentHistoryManagerVisibility
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ employment_history_manager_visibility: visibility })
    .eq("id", organizationId);
  if (error) {
    console.error("setEmploymentHistoryManagerVisibility failed:", error);
    return { error: "Could not save this setting — the database may need migration 0170 run first." };
  }
  return { success: true };
}
