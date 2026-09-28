import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ALL_DOC_TYPES } from "@/lib/employeeFile/constants";

export type MissingDocumentsItem = {
  employeeUserId: string;
  employeeName: string;
  missingDocLabels: string[];
};

// Computes, per active employee, which of the org's required document
// types (organizations.required_employee_doc_types, 0187 -- a mix of the
// 6 fixed system keys and organization_document_types ids, 0188) haven't
// been uploaded yet. No new RPC needed: org admins already have full
// SELECT on employee_documents and organization_members via existing RLS
// (0181, 0016), so this is a handful of plain reads plus in-memory set
// subtraction -- same shape as buildCompanyData's own roster-assembly
// pattern, not a SECURITY DEFINER function, because nothing here needs to
// bypass RLS. Labels are resolved here (fixed via i18n, custom via a
// lookup) so the widget rendering this doesn't need its own DB access.
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

  const customIds = required.filter((t) => !(ALL_DOC_TYPES as readonly string[]).includes(t));

  const [{ data: profiles }, { data: docs }, { data: customTypes }, t] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", memberIds).returns<{ id: string; full_name: string | null }[]>(),
    supabase
      .from("employee_documents")
      .select("user_id, doc_type")
      .eq("organization_id", organizationId)
      .in("user_id", memberIds)
      .returns<{ user_id: string; doc_type: string }[]>(),
    customIds.length
      ? supabase.from("organization_document_types").select("id, display_label").eq("organization_id", organizationId).in("id", customIds).returns<{ id: string; display_label: string }[]>()
      : Promise.resolve({ data: [] as { id: string; display_label: string }[] }),
    getTranslations("employeeFile"),
  ]);

  const customLabelById = new Map((customTypes ?? []).map((r) => [r.id, r.display_label]));
  const labelFor = (docType: string): string =>
    (ALL_DOC_TYPES as readonly string[]).includes(docType) ? t(`doc_${docType}`) : (customLabelById.get(docType) ?? t("docUnknown"));

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));
  const presentByUser = new Map<string, Set<string>>();
  for (const d of docs ?? []) {
    if (!presentByUser.has(d.user_id)) presentByUser.set(d.user_id, new Set());
    presentByUser.get(d.user_id)!.add(d.doc_type);
  }

  const items: MissingDocumentsItem[] = [];
  for (const userId of memberIds) {
    const present = presentByUser.get(userId) ?? new Set<string>();
    const missing = required.filter((docType) => !present.has(docType));
    if (missing.length > 0) {
      items.push({ employeeUserId: userId, employeeName: nameById.get(userId) ?? "—", missingDocLabels: missing.map(labelFor) });
    }
  }
  return items.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}
