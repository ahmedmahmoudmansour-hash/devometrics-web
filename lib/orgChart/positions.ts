"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";

const REVALIDATE_PATH = "/dashboard/company/org-chart";

export type OrgPositionKind = "vacant_role" | "structural";
export type OrgPositionStatus = "open" | "future" | "frozen" | "filled";

export type OrgPositionRow = {
  id: string;
  kind: OrgPositionKind;
  status: OrgPositionStatus;
  title: string;
  department: string | null;
  businessUnit: string | null;
  country: string | null;
  location: string | null;
  parentPositionId: string | null;
  parentMemberUserId: string | null;
  linkedPostingId: string | null;
  linkedPostingTitle: string | null;
  linkedPostingStatus: "draft" | "open" | "closed" | null;
  linkedRoleId: string | null;
  linkedRoleTitle: string | null;
  linkedRoleGrade: number | null;
  linkedRoleLevel: string | null;
  headcount: number | null;
  details: string | null;
};

type PositionSelectRow = {
  id: string;
  kind: string;
  status: string;
  title: string;
  department: string | null;
  business_unit: string | null;
  country: string | null;
  location: string | null;
  parent_position_id: string | null;
  parent_member_user_id: string | null;
  linked_posting_id: string | null;
  linked_role_id: string | null;
  headcount: number | null;
  details: string | null;
};

function toRow(
  r: PositionSelectRow,
  postingsById: Map<string, { title: string; status: string }>,
  rolesById: Map<string, { title: string; grade: number; level: string }>
): OrgPositionRow {
  const posting = r.linked_posting_id ? postingsById.get(r.linked_posting_id) : undefined;
  const role = r.linked_role_id ? rolesById.get(r.linked_role_id) : undefined;
  return {
    id: r.id,
    kind: r.kind as OrgPositionKind,
    status: r.status as OrgPositionStatus,
    title: r.title,
    department: r.department,
    businessUnit: r.business_unit,
    country: r.country,
    location: r.location,
    parentPositionId: r.parent_position_id,
    parentMemberUserId: r.parent_member_user_id,
    linkedPostingId: r.linked_posting_id,
    linkedPostingTitle: posting?.title ?? null,
    linkedPostingStatus: (posting?.status as OrgPositionRow["linkedPostingStatus"]) ?? null,
    linkedRoleId: r.linked_role_id,
    linkedRoleTitle: role?.title ?? null,
    linkedRoleGrade: role?.grade ?? null,
    linkedRoleLevel: role?.level ?? null,
    headcount: r.headcount,
    details: r.details,
  };
}

const POSITION_COLUMNS =
  "id, kind, status, title, department, business_unit, country, location, parent_position_id, parent_member_user_id, linked_posting_id, linked_role_id, headcount, details";

// Live chart data only — status='filled' rows are excluded. A filled
// position's slot in the tree is now represented by the real employee's
// own card (fill_org_position already pointed their manager_user_id/
// manager_position_id at wherever the vacancy sat); the row itself is kept
// as history but is no longer a rendered node. Lazy, org-chart-only query
// — deliberately not folded into WorkforceRow/buildCompanyData, same
// posture as successionStatus.ts's getNominatedUserIds.
export async function listPositions(): Promise<OrgPositionRow[]> {
  const data = await buildCompanyData();
  if (!data.organizationId) return [];
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("org_positions")
    .select(POSITION_COLUMNS)
    .eq("organization_id", data.organizationId)
    .neq("status", "filled")
    .returns<PositionSelectRow[]>();
  if (!rows || rows.length === 0) return [];

  const postingIds = [...new Set(rows.map((r) => r.linked_posting_id).filter((v): v is string => !!v))];
  const roleIds = [...new Set(rows.map((r) => r.linked_role_id).filter((v): v is string => !!v))];

  const [{ data: postings }, { data: roles }] = await Promise.all([
    postingIds.length > 0
      ? supabase.from("job_postings").select("id, title, status").in("id", postingIds).returns<{ id: string; title: string; status: string }[]>()
      : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
    roleIds.length > 0
      ? supabase.from("job_roles").select("id, title, grade, level").in("id", roleIds).returns<{ id: string; title: string; grade: number; level: string }[]>()
      : Promise.resolve({ data: [] as { id: string; title: string; grade: number; level: string }[] }),
  ]);

  const postingsById = new Map((postings ?? []).map((p) => [p.id, { title: p.title, status: p.status }]));
  const rolesById = new Map((roles ?? []).map((r) => [r.id, { title: r.title, grade: r.grade, level: r.level }]));

  return rows.map((r) => toRow(r, postingsById, rolesById));
}

// Powers the linked-posting/linked-role pickers in the position panel.
export async function listOpenPostingsAndRoles(): Promise<{
  postings: { id: string; title: string; status: string }[];
  roles: { id: string; title: string; level: string; grade: number }[];
}> {
  const data = await buildCompanyData();
  if (!data.organizationId) return { postings: [], roles: [] };
  const supabase = await createClient();
  const [{ data: postings }, { data: roles }] = await Promise.all([
    supabase
      .from("job_postings")
      .select("id, title, status")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .returns<{ id: string; title: string; status: string }[]>(),
    supabase
      .from("job_roles")
      .select("id, title, level, grade")
      .eq("organization_id", data.organizationId)
      .order("title", { ascending: true })
      .returns<{ id: string; title: string; level: string; grade: number }[]>(),
  ]);
  return { postings: postings ?? [], roles: roles ?? [] };
}

// Lazy lookup of which members currently report to a vacant position
// instead of a real manager. WorkforceRow/buildCompanyData deliberately
// isn't extended with manager_position_id (many unrelated pages consume
// WorkforceRow and shouldn't pay for a join they don't need) — the merged
// tree fetches this separately instead, same posture as
// successionStatus.ts's getNominatedUserIds. Keyed by userId.
export async function listMemberManagerPositions(): Promise<Map<string, string>> {
  const data = await buildCompanyData();
  if (!data.organizationId) return new Map();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("organization_members")
    .select("user_id, manager_position_id")
    .eq("organization_id", data.organizationId)
    .not("manager_position_id", "is", null)
    .returns<{ user_id: string; manager_position_id: string }[]>();
  return new Map((rows ?? []).map((r) => [r.user_id, r.manager_position_id]));
}

export async function createPosition(input: {
  kind: OrgPositionKind;
  title: string;
  department?: string | null;
  businessUnit?: string | null;
  country?: string | null;
  location?: string | null;
  parentPositionId?: string | null;
  parentMemberUserId?: string | null;
  linkedPostingId?: string | null;
  linkedRoleId?: string | null;
  headcount?: number | null;
  details?: string | null;
}): Promise<{ success: true; id: string } | { error: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = input.title.trim();
  if (!title) return { error: "Give this position a title" };
  if (input.parentPositionId && input.parentMemberUserId) {
    return { error: "A position can report to another position or an employee, not both." };
  }

  const { data: inserted, error } = await supabase
    .from("org_positions")
    .insert({
      organization_id: data.organizationId,
      kind: input.kind,
      title,
      department: input.department ?? null,
      business_unit: input.businessUnit ?? null,
      country: input.country ?? null,
      location: input.location ?? null,
      parent_position_id: input.parentPositionId ?? null,
      parent_member_user_id: input.parentMemberUserId ?? null,
      linked_posting_id: input.kind === "vacant_role" ? input.linkedPostingId ?? null : null,
      linked_role_id: input.kind === "vacant_role" ? input.linkedRoleId ?? null : null,
      headcount: input.headcount ?? null,
      details: input.details?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) return { error: "Could not create this position — the database may need migration 0106 run first." };

  revalidatePath(REVALIDATE_PATH);
  return { success: true, id: inserted.id };
}

// Kind is deliberately not patchable here — switching vacant_role <->
// structural mid-flight conflicts with the linked-posting/role constraint;
// delete and recreate instead. Status only ever moves between the three
// admin-settable values; 'filled' is system-set exclusively by
// fill_org_position via fillPosition() below.
export async function updatePosition(
  id: string,
  patch: {
    title?: string;
    department?: string | null;
    businessUnit?: string | null;
    country?: string | null;
    location?: string | null;
    status?: Exclude<OrgPositionStatus, "filled">;
    linkedPostingId?: string | null;
    linkedRoleId?: string | null;
    headcount?: number | null;
    details?: string | null;
  }
): Promise<{ success: true } | { error: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const trimmed = patch.title.trim();
    if (!trimmed) return { error: "Give this position a title" };
    update.title = trimmed;
  }
  if (patch.department !== undefined) update.department = patch.department;
  if (patch.businessUnit !== undefined) update.business_unit = patch.businessUnit;
  if (patch.country !== undefined) update.country = patch.country;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.linkedPostingId !== undefined) update.linked_posting_id = patch.linkedPostingId;
  if (patch.linkedRoleId !== undefined) update.linked_role_id = patch.linkedRoleId;
  if (patch.headcount !== undefined) update.headcount = patch.headcount;
  if (patch.details !== undefined) update.details = patch.details?.trim() || null;

  const { error } = await supabase.from("org_positions").update(update).eq("id", id).eq("organization_id", data.organizationId);
  if (error) return { error: "Could not update this position — try again." };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// Cancels a position that was never filled — re-parents its children up to
// its own parent, then actually deletes the row. Distinct from fillPosition
// below, which keeps the row as history.
export async function deletePosition(id: string): Promise<{ success: true } | { error: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) return { error: "Not authorized" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_org_position", { target_position_id: id });
  if (error) return { error: "Could not delete this position — the database may need migration 0106 run first." };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// Marks a vacant role filled by a real employee, placing them exactly
// where the vacancy sat and moving its direct reports onto them (all done
// atomically inside the fill_org_position RPC). The position row is kept
// as a permanent record (status='filled', occupant, filled_at) rather than
// deleted — see migration 0106's comment for why. Not part of the
// automatic new-hire trigger chain (runHireWelcome); an admin calls this
// explicitly once the new hire's account already exists.
export async function fillPosition(positionId: string, employeeUserId: string): Promise<{ success: true } | { error: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: position }, { data: employee }] = await Promise.all([
    supabase
      .from("org_positions")
      .select("parent_position_id, parent_member_user_id")
      .eq("id", positionId)
      .maybeSingle<{ parent_position_id: string | null; parent_member_user_id: string | null }>(),
    supabase
      .from("organization_members")
      .select("manager_user_id, manager_position_id")
      .eq("organization_id", data.organizationId)
      .eq("user_id", employeeUserId)
      .maybeSingle<{ manager_user_id: string | null; manager_position_id: string | null }>(),
  ]);

  const { error } = await supabase.rpc("fill_org_position", { target_position_id: positionId, target_employee_user_id: employeeUserId });
  if (error) return { error: "Could not fill this position — the database may need migration 0106 run first." };

  // Same audit trail setMemberManager writes to for a real-to-real
  // reparent (Phase 1 of the retention/Flight Risk roadmap) — old_value/
  // new_value are plain text, so a position-typed endpoint is tagged
  // `position:<uuid>` to stay distinguishable from a real user id.
  const previousValue = employee?.manager_position_id ? `position:${employee.manager_position_id}` : employee?.manager_user_id ?? null;
  const newValue = position?.parent_position_id ? `position:${position.parent_position_id}` : position?.parent_member_user_id ?? null;
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

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/dashboard/company/employees");
  return { success: true };
}
