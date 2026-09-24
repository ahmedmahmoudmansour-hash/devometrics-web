"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_ATTACHMENTS_BUCKET } from "@/lib/leave/constants";

// Unlike lib/compensation/actions.ts, most of this file uses normal
// `.from(...)` calls, not RPCs — leave_types/leave_balances/leave_requests
// all use direct table RLS (is_org_admin / is_manager_of_user / self), the
// same lighter-weight pattern as performance reviews (migration 0078), not
// compensation's zero-client-policy RPC-only lockdown. Only approval
// (decideLeaveRequest) goes through an RPC, since that specifically must
// not be a raw UPDATE a manager/admin could otherwise bypass — see 0166's
// header for why.

export type LeaveType = {
  id: string;
  name: string;
  color: string | null;
  isPaid: boolean;
  requiresApproval: boolean;
  defaultAnnualDays: number;
  // 0174 — 'everyone' (default, every pre-existing type) or 'restricted',
  // meaning only employees with a leave_type_eligibility grant can see/
  // request it. Admin-facing listLeaveTypes() always returns every type
  // regardless of this flag (HR manages the grant list); the employee-
  // facing listMyEligibleLeaveTypes() is what actually filters on it.
  eligibility: "everyone" | "restricted";
};

type RawLeaveType = {
  id: string;
  name: string;
  color: string | null;
  is_paid: boolean;
  requires_approval: boolean;
  default_annual_days: number;
  eligibility: string;
};

function mapLeaveType(t: RawLeaveType): LeaveType {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    isPaid: t.is_paid,
    requiresApproval: t.requires_approval,
    defaultAnnualDays: t.default_annual_days,
    eligibility: t.eligibility === "restricted" ? "restricted" : "everyone",
  };
}

const LEAVE_TYPE_COLUMNS = "id, name, color, is_paid, requires_approval, default_annual_days, eligibility";

// Admin-facing — always every type in the org, regardless of eligibility.
// HR needs the full list to manage it; see listMyEligibleLeaveTypes for
// the employee-facing, eligibility-filtered equivalent.
export async function listLeaveTypes(organizationId: string): Promise<LeaveType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_types")
    .select(LEAVE_TYPE_COLUMNS)
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
    .returns<RawLeaveType[]>();
  return (data ?? []).map(mapLeaveType);
}

// What the current employee is actually allowed to see/request: every
// 'everyone' type, plus any 'restricted' type they've been explicitly
// granted (leave_type_eligibility, 0174). Two plain selects rather than an
// RPC — leave_type_eligibility's own SELECT policy already scopes the
// second query to the caller's own grants, so no cross-user data ever
// passes through here.
export async function listMyEligibleLeaveTypes(organizationId: string): Promise<LeaveType[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: types }, { data: grants }] = await Promise.all([
    supabase.from("leave_types").select(LEAVE_TYPE_COLUMNS).eq("organization_id", organizationId).order("name", { ascending: true }).returns<RawLeaveType[]>(),
    supabase.from("leave_type_eligibility").select("leave_type_id").eq("employee_user_id", user.id).returns<{ leave_type_id: string }[]>(),
  ]);
  const grantedIds = new Set((grants ?? []).map((g) => g.leave_type_id));
  return (types ?? []).filter((t) => t.eligibility !== "restricted" || grantedIds.has(t.id)).map(mapLeaveType);
}

// Org-wide map of leave_type_id -> the employee_user_ids currently
// eligible for it — one query for the admin settings UI instead of N
// per-type lookups. Only meaningful for 'restricted' types; 'everyone'
// types simply won't have rows here (or may have stale ones left over
// from before a type was switched back to 'everyone' — harmless, since
// eligibility is never consulted for a non-restricted type).
export async function listLeaveTypeEligibility(organizationId: string): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_type_eligibility")
    .select("leave_type_id, employee_user_id")
    .eq("organization_id", organizationId)
    .returns<{ leave_type_id: string; employee_user_id: string }[]>();
  const byType: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (byType[row.leave_type_id] ??= []).push(row.employee_user_id);
  }
  return byType;
}

export async function createLeaveType(
  organizationId: string,
  fields: {
    name: string;
    color: string | null;
    isPaid: boolean;
    requiresApproval: boolean;
    defaultAnnualDays: number;
    eligibility?: "everyone" | "restricted";
    eligibleEmployeeIds?: string[];
  }
): Promise<{ error: string } | { success: true; id: string }> {
  const trimmedName = fields.name.trim();
  if (!trimmedName) return { error: "Name is required" };
  if (fields.defaultAnnualDays < 0) return { error: "Default days cannot be negative" };
  const eligibility = fields.eligibility === "restricted" ? "restricted" : "everyone";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("leave_types")
    .insert({
      organization_id: organizationId,
      name: trimmedName,
      color: fields.color,
      is_paid: fields.isPaid,
      requires_approval: fields.requiresApproval,
      default_annual_days: fields.defaultAnnualDays,
      eligibility,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    if (error?.code === "23505") return { error: "A leave type with this name already exists" };
    console.error("createLeaveType failed:", error);
    return { error: "Could not create leave type — the database may need migration 0166 run first." };
  }

  if (eligibility === "restricted" && fields.eligibleEmployeeIds?.length) {
    await supabase.from("leave_type_eligibility").insert(
      fields.eligibleEmployeeIds.map((employeeUserId) => ({
        organization_id: organizationId,
        leave_type_id: data.id,
        employee_user_id: employeeUserId,
        created_by: user.id,
      }))
    );
  }

  revalidatePath("/dashboard/company/leave");
  return { success: true, id: data.id };
}

// Changes an EXISTING type's eligibility after the fact — this is the path
// for the Maternity/Paternity-style case Ahmed flagged: a type that was
// created as 'everyone' (or just needs its grant list updated) gets
// switched to 'restricted' with a specific set of employees. Replaces the
// whole grant list atomically-enough for this data (delete-then-insert;
// worst case on a race is a missed grant, not a security hole, since the
// eligibility check is additive-only and RLS still requires is_org_admin
// for every write here).
export async function setLeaveTypeEligibility(
  organizationId: string,
  leaveTypeId: string,
  eligibility: "everyone" | "restricted",
  eligibleEmployeeIds: string[]
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: updateError } = await supabase.from("leave_types").update({ eligibility }).eq("id", leaveTypeId);
  if (updateError) {
    console.error("setLeaveTypeEligibility (update) failed:", updateError);
    return { error: "Could not save eligibility — the database may need migration 0174 run first." };
  }

  const { error: deleteError } = await supabase.from("leave_type_eligibility").delete().eq("leave_type_id", leaveTypeId);
  if (deleteError) {
    console.error("setLeaveTypeEligibility (clear grants) failed:", deleteError);
    return { error: "Could not save the eligible-employee list" };
  }

  if (eligibility === "restricted" && eligibleEmployeeIds.length) {
    const { error: insertError } = await supabase.from("leave_type_eligibility").insert(
      eligibleEmployeeIds.map((employeeUserId) => ({
        organization_id: organizationId,
        leave_type_id: leaveTypeId,
        employee_user_id: employeeUserId,
        created_by: user.id,
      }))
    );
    if (insertError) {
      console.error("setLeaveTypeEligibility (insert grants) failed:", insertError);
      return { error: "Could not save the eligible-employee list" };
    }
  }

  revalidatePath("/dashboard/company/leave");
  revalidatePath("/dashboard/leave");
  return { success: true };
}

export async function deleteLeaveType(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.from("leave_types").delete().eq("id", id);
  if (error) {
    console.error("deleteLeaveType failed:", error);
    return { error: "Could not delete this leave type" };
  }
  revalidatePath("/dashboard/company/leave");
  return { success: true };
}

export type LeaveBalance = {
  id: string;
  employeeUserId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
};

type RawLeaveBalance = { id: string; employee_user_id: string; leave_type_id: string; year: number; allocated_days: number; used_days: number };

// Org-wide, for the admin dashboard — RLS naturally restricts this to
// is_org_admin, same as every other org-wide compensation list.
export async function listOrgLeaveBalances(organizationId: string, year: number): Promise<LeaveBalance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_balances")
    .select("id, employee_user_id, leave_type_id, year, allocated_days, used_days")
    .eq("organization_id", organizationId)
    .eq("year", year)
    .returns<RawLeaveBalance[]>();
  return (data ?? []).map((b) => ({
    id: b.id,
    employeeUserId: b.employee_user_id,
    leaveTypeId: b.leave_type_id,
    year: b.year,
    allocatedDays: b.allocated_days,
    usedDays: b.used_days,
  }));
}

export async function getMyLeaveBalances(year: number): Promise<LeaveBalance[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("leave_balances")
    .select("id, employee_user_id, leave_type_id, year, allocated_days, used_days")
    .eq("employee_user_id", user.id)
    .eq("year", year)
    .returns<RawLeaveBalance[]>();
  return (data ?? []).map((b) => ({
    id: b.id,
    employeeUserId: b.employee_user_id,
    leaveTypeId: b.leave_type_id,
    year: b.year,
    allocatedDays: b.allocated_days,
    usedDays: b.used_days,
  }));
}

// HR sets/corrects an allocation directly — upsert since a balance row
// might not exist yet (it's otherwise only auto-created by the approval
// trigger, seeded from the leave type's default).
export async function setLeaveBalanceAllocation(
  organizationId: string,
  employeeUserId: string,
  leaveTypeId: string,
  year: number,
  allocatedDays: number
): Promise<{ error: string } | { success: true }> {
  if (allocatedDays < 0) return { error: "Allocation cannot be negative" };

  const supabase = await createClient();
  const { error } = await supabase.from("leave_balances").upsert(
    {
      organization_id: organizationId,
      employee_user_id: employeeUserId,
      leave_type_id: leaveTypeId,
      year,
      allocated_days: allocatedDays,
    },
    { onConflict: "organization_id,employee_user_id,leave_type_id,year", ignoreDuplicates: false }
  );
  if (error) {
    console.error("setLeaveBalanceAllocation failed:", error);
    return { error: "Could not save this allocation — the database may need migration 0166 run first." };
  }

  revalidatePath("/dashboard/company/leave");
  return { success: true };
}

export type LeaveRequest = {
  id: string;
  employeeUserId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionComment: string | null;
  // Set only if HR later changed an already-decided request — the
  // original decision fields above are left untouched, so both the
  // original call and the override are visible (0167).
  overriddenAt: string | null;
  overriddenBy: string | null;
  overrideReason: string | null;
  // Optional supporting document (sick note, birth certificate, ...) —
  // set only after a successful upload (0171). Never contains the file
  // itself, just enough to fetch a short-lived signed URL on demand via
  // getLeaveAttachmentUrl().
  attachmentFileName: string | null;
};

type RawLeaveRequest = {
  id: string;
  employee_user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
  reason: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_comment: string | null;
  overridden_at: string | null;
  overridden_by: string | null;
  override_reason: string | null;
  attachment_file_name: string | null;
};

function mapLeaveRequest(r: RawLeaveRequest): LeaveRequest {
  return {
    id: r.id,
    employeeUserId: r.employee_user_id,
    leaveTypeId: r.leave_type_id,
    startDate: r.start_date,
    endDate: r.end_date,
    daysRequested: r.days_requested,
    status: r.status as LeaveRequest["status"],
    reason: r.reason,
    requestedAt: r.requested_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    decisionComment: r.decision_comment,
    overriddenAt: r.overridden_at,
    overriddenBy: r.overridden_by,
    overrideReason: r.override_reason,
    attachmentFileName: r.attachment_file_name,
  };
}

const LEAVE_REQUEST_COLUMNS =
  "id, employee_user_id, leave_type_id, start_date, end_date, days_requested, status, reason, requested_at, decided_at, decided_by, decision_comment, overridden_at, overridden_by, override_reason, attachment_file_name";

export async function listMyLeaveRequests(): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("leave_requests")
    .select(LEAVE_REQUEST_COLUMNS)
    .eq("employee_user_id", user.id)
    .order("start_date", { ascending: false })
    .returns<RawLeaveRequest[]>();
  return (data ?? []).map(mapLeaveRequest);
}

// A manager's direct reports only — RLS (is_manager_of_user) enforces this
// regardless of what's asked for, same defense-in-depth posture as
// everywhere else in this app.
export async function listTeamLeaveRequests(organizationId: string): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select(LEAVE_REQUEST_COLUMNS)
    .eq("organization_id", organizationId)
    .order("requested_at", { ascending: false })
    .returns<RawLeaveRequest[]>();
  return (data ?? []).map(mapLeaveRequest);
}

// Org admin only — RLS restricts this the same way.
export async function listOrgLeaveRequests(organizationId: string): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select(LEAVE_REQUEST_COLUMNS)
    .eq("organization_id", organizationId)
    .order("requested_at", { ascending: false })
    .returns<RawLeaveRequest[]>();
  return (data ?? []).map(mapLeaveRequest);
}

// ============================================================
// Leave request attachments (0171) — same private-bucket-plus-signed-URL
// pattern as candidate CVs / Knowledge Hub content. The client uploads
// directly to storage.leave-attachments (see MyLeaveManager.tsx for the
// upload call and the exact storagePath shape), then calls this to save
// the metadata onto the row. Storage RLS is the real gate on the raw
// bytes; this just records what got uploaded for a signed URL later.
// ============================================================

export async function attachLeaveRequestFile(
  requestId: string,
  meta: { storagePath: string; fileName: string }
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("leave_requests")
    .update({ attachment_storage_path: meta.storagePath, attachment_file_name: meta.fileName.slice(0, 255) })
    .eq("id", requestId)
    .eq("employee_user_id", user.id);
  if (error) {
    console.error("attachLeaveRequestFile failed:", error);
    return { error: "Could not attach the file — the database may need migration 0171 run first." };
  }

  revalidatePath("/dashboard/leave");
  return { success: true };
}

// Self, org admin, or the employee's manager — mirrors leave_requests'
// own SELECT policy exactly, so this never opens up more than the caller
// could already see about the request itself. The table read (not the
// storage RLS policy) is what actually enforces this: a caller who can't
// see the row gets no path back, full stop.
export async function getLeaveAttachmentUrl(requestId: string): Promise<{ error: string } | { url: string }> {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("leave_requests")
    .select("attachment_storage_path")
    .eq("id", requestId)
    .maybeSingle<{ attachment_storage_path: string | null }>();
  if (!request?.attachment_storage_path) return { error: "No attachment found" };

  const { data, error } = await supabase.storage.from(LEAVE_ATTACHMENTS_BUCKET).createSignedUrl(request.attachment_storage_path, 300);
  if (error || !data) return { error: "Could not open this file — try again." };

  return { url: data.signedUrl };
}

// ============================================================
// Leave manager visibility (0169) — mirrors compensation's manager-
// visibility toggle (getCompensationManagerVisibility/set...), same direct
// .from("organizations") pattern rather than a dedicated RPC, protected by
// the same is_org_admin UPDATE policy on organizations (and the 0164
// ownership-column trigger, which doesn't apply here since this isn't an
// ownership column). Binary, not 3-state — see 0169's header for why.
// ============================================================

export type LeaveManagerVisibility = "visible" | "hidden";

export async function getLeaveManagerVisibility(organizationId: string): Promise<LeaveManagerVisibility> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("leave_manager_visibility")
    .eq("id", organizationId)
    .maybeSingle<{ leave_manager_visibility: string | null }>();
  return data?.leave_manager_visibility === "hidden" ? "hidden" : "visible";
}

export async function setLeaveManagerVisibility(
  organizationId: string,
  visibility: LeaveManagerVisibility
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ leave_manager_visibility: visibility })
    .eq("id", organizationId);
  if (error) {
    console.error("setLeaveManagerVisibility failed:", error);
    return { error: "Could not save this setting — the database may need migration 0169 run first." };
  }

  revalidatePath("/dashboard/company/leave");
  return { success: true };
}

// A manager's own reports' balances only — the "browse my team" surface
// gated by leave_manager_visibility (see 0169's header for why this is
// separate from the untouched pending-approval path).
export async function listTeamLeaveOverview(organizationId: string): Promise<LeaveBalance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_team_leave_overview", { check_org_id: organizationId });
  if (error || !data) return [];
  const rows = data as { employee_user_id: string; leave_type_id: string; year: number; allocated_days: number; used_days: number }[];
  return rows.map((b) => ({
    id: `${b.employee_user_id}-${b.leave_type_id}-${b.year}`,
    employeeUserId: b.employee_user_id,
    leaveTypeId: b.leave_type_id,
    year: b.year,
    allocatedDays: b.allocated_days,
    usedDays: b.used_days,
  }));
}

export async function requestLeave(input: {
  organizationId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
}): Promise<{ error: string } | { success: true; id: string }> {
  if (input.daysRequested <= 0) return { error: "Days requested must be positive" };
  if (input.endDate < input.startDate) return { error: "End date cannot be before start date" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      organization_id: input.organizationId,
      employee_user_id: user.id,
      leave_type_id: input.leaveTypeId,
      start_date: input.startDate,
      end_date: input.endDate,
      days_requested: input.daysRequested,
      reason: input.reason,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("requestLeave failed:", error);
    return { error: "Could not submit request — the database may need migration 0166 run first." };
  }

  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/my-team");
  return { success: true, id: data.id };
}

// Admin-only path (RLS enforces it) — records leave that's already been
// approved elsewhere (verbal approval, historical record, etc.) without
// the request/decide dance. Same "admin can act org-wide, not just their
// own reports" capability that was missing from compensation's original
// build and had to be retrofitted — designed in here from the start.
export async function recordLeaveDirectly(input: {
  organizationId: string;
  employeeUserId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
}): Promise<{ error: string } | { success: true; id: string }> {
  if (input.daysRequested <= 0) return { error: "Days requested must be positive" };
  if (input.endDate < input.startDate) return { error: "End date cannot be before start date" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      organization_id: input.organizationId,
      employee_user_id: input.employeeUserId,
      leave_type_id: input.leaveTypeId,
      start_date: input.startDate,
      end_date: input.endDate,
      days_requested: input.daysRequested,
      reason: input.reason,
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("recordLeaveDirectly failed:", error);
    return { error: "Could not record this leave — the database may need migration 0166 run first." };
  }

  revalidatePath("/dashboard/company/leave");
  return { success: true, id: data.id };
}

export async function cancelLeaveRequest(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
  if (error) {
    console.error("cancelLeaveRequest failed:", error);
    return { error: "Could not cancel this request" };
  }
  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/my-team");
  revalidatePath("/dashboard/company/leave");
  return { success: true };
}

export async function decideLeaveRequest(
  requestId: string,
  decision: "approved" | "rejected",
  comment: string | null
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_comment: comment,
  });
  if (error) {
    console.error("decideLeaveRequest failed:", error);
    return {
      error: error.message?.includes("already been decided")
        ? "This request has already been decided"
        : error.message?.includes("cannot decide your own")
          ? error.message
          : "Could not record this decision",
    };
  }

  revalidatePath("/dashboard/company/leave");
  revalidatePath("/dashboard/my-team");
  return { success: true };
}

// Org-admin only (enforced in the RPC) — changes an already-decided
// (approved/rejected) request. The original decision fields are left
// untouched; this is a separate, visible event (0167).
export async function overrideLeaveDecision(
  requestId: string,
  decision: "approved" | "rejected",
  reason: string | null
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("override_leave_decision", {
    p_request_id: requestId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) {
    console.error("overrideLeaveDecision failed:", error);
    return {
      error: error.message?.includes("already set to this decision")
        ? "Already set to this decision"
        : error.message?.includes("Only an already-decided")
          ? "Only an already-decided request can be overridden"
          : error.message?.includes("cannot override your own")
            ? error.message
            : "Could not override this decision — the database may need migration 0167 run first.",
    };
  }

  revalidatePath("/dashboard/company/leave");
  revalidatePath("/dashboard/my-team");
  return { success: true };
}
