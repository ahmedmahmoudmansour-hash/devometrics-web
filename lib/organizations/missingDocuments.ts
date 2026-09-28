import { createClient } from "@/lib/supabase/server";

export type MissingDocumentsItem = {
  employeeUserId: string;
  employeeName: string;
  missingDocTypes: string[];
};

// Computes, per active employee, which of the org's required document
// types (organizations.required_employee_doc_types, 0187) haven't been
// uploaded yet. No new RPC needed: org admins already have full SELECT on
// employee_documents and organization_members via existing RLS (0181,
// 0016), so this is three plain reads plus in-memory set subtraction --
// same shape as buildCompanyData's own roster-assembly pattern, not a
// SECURITY DEFINER function, because nothing here needs to bypass RLS.
export async function getMissingDocuments(organizationId: string): Promise<MissingDocumentsItem[]> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("required_employee_doc_types")
    .eq("id", organizationId)
    .maybeSingle<{ required_employee_doc_types: string[] | null }>();
  const required = org?.required_employee_doc_types ?? [];
  if (required.length === 0) return [];

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("employment_status", "active")
    .returns<{ user_id: string }[]>();
  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return [];

  const [{ data: profiles }, { data: docs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", memberIds).returns<{ id: string; full_name: string | null }[]>(),
    supabase
      .from("employee_documents")
      .select("user_id, doc_type")
      .eq("organization_id", organizationId)
      .in("user_id", memberIds)
      .returns<{ user_id: string; doc_type: string }[]>(),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));
  const presentByUser = new Map<string, Set<string>>();
  for (const d of docs ?? []) {
    if (!presentByUser.has(d.user_id)) presentByUser.set(d.user_id, new Set());
    presentByUser.get(d.user_id)!.add(d.doc_type);
  }

  const items: MissingDocumentsItem[] = [];
  for (const userId of memberIds) {
    const present = presentByUser.get(userId) ?? new Set<string>();
    const missing = required.filter((t) => !present.has(t));
    if (missing.length > 0) {
      items.push({ employeeUserId: userId, employeeName: nameById.get(userId) ?? "—", missingDocTypes: missing });
    }
  }
  return items.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}
