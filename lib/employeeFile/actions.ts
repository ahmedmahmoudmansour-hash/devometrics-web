"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  EMPLOYEE_DOCUMENTS_BUCKET,
  EMPLOYEE_DOC_TYPES,
  ALL_DOC_TYPES,
  MARITAL_STATUSES,
  EMPLOYMENT_TYPES,
  DEPENDENT_RELATIONS,
  isFileSection,
  type EmployeeFileData,
  type EmployeeDependent,
  type EmployeeDocument,
} from "@/lib/employeeFile/constants";

// Everything here rides on RLS (0181): the employee reads/edits their own
// file, org admins read/edit anyone's in their company, nobody else sees any
// of it. These actions add input validation and (for admins looking at
// someone else) an access-log entry; they never widen access.

type Client = Awaited<ReturnType<typeof createClient>>;

async function currentUser(supabase: Client) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

type RawProfile = {
  legal_name: string | null; date_of_birth: string | null; gender: string | null; nationality: string | null; national_id: string | null;
  marital_status: string | null; personal_phone: string | null; personal_email: string | null; address_line1: string | null;
  address_line2: string | null; city: string | null; region: string | null; postal_code: string | null; country: string | null;
  emergency_contact_name: string | null; emergency_contact_relation: string | null; emergency_contact_phone: string | null;
  hire_date: string | null; employment_type: string | null; probation_end_date: string | null;
};

const PROFILE_COLUMNS =
  "legal_name, date_of_birth, gender, nationality, national_id, marital_status, personal_phone, personal_email, address_line1, address_line2, city, region, postal_code, country, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, hire_date, employment_type, probation_end_date";

function mapProfile(r: RawProfile | null): EmployeeFileData | null {
  if (!r) return null;
  return {
    legalName: r.legal_name ?? "", dateOfBirth: r.date_of_birth ?? "", gender: r.gender ?? "", nationality: r.nationality ?? "",
    nationalId: r.national_id ?? "", maritalStatus: r.marital_status ?? "", personalPhone: r.personal_phone ?? "",
    personalEmail: r.personal_email ?? "", addressLine1: r.address_line1 ?? "", addressLine2: r.address_line2 ?? "",
    city: r.city ?? "", region: r.region ?? "", postalCode: r.postal_code ?? "", country: r.country ?? "",
    emergencyContactName: r.emergency_contact_name ?? "", emergencyContactRelation: r.emergency_contact_relation ?? "",
    emergencyContactPhone: r.emergency_contact_phone ?? "", hireDate: r.hire_date ?? "", employmentType: r.employment_type ?? "",
    probationEndDate: r.probation_end_date ?? "",
  };
}

export type EmployeeFileBundle = {
  profile: EmployeeFileData | null;
  dependents: EmployeeDependent[];
  documents: EmployeeDocument[];
};

// userId omitted = the caller's own file. For someone else, RLS returns
// nothing unless the caller is an admin of that person's company; an admin
// opening another person's file is logged.
export async function getEmployeeFile(organizationId: string, userId?: string): Promise<EmployeeFileBundle> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  const empty: EmployeeFileBundle = { profile: null, dependents: [], documents: [] };
  if (!user) return empty;
  const targetId = userId ?? user.id;

  const [{ data: profile }, { data: deps }, { data: docs }] = await Promise.all([
    supabase.from("employee_profiles").select(PROFILE_COLUMNS).eq("organization_id", organizationId).eq("user_id", targetId).maybeSingle<RawProfile>(),
    supabase
      .from("employee_dependents")
      .select("id, full_name, relation, date_of_birth, notes")
      .eq("organization_id", organizationId)
      .eq("user_id", targetId)
      .order("created_at", { ascending: true })
      .returns<{ id: string; full_name: string; relation: string; date_of_birth: string | null; notes: string | null }[]>(),
    supabase
      .from("employee_documents")
      .select("id, doc_type, title, file_name, expires_on, uploaded_by, created_at")
      .eq("organization_id", organizationId)
      .eq("user_id", targetId)
      .order("created_at", { ascending: false })
      .returns<{ id: string; doc_type: string; title: string; file_name: string; expires_on: string | null; uploaded_by: string | null; created_at: string }[]>(),
  ]);

  if (targetId !== user.id) {
    // Only reaches here with data if RLS let an admin through; best-effort log.
    await supabase.from("employee_file_access_log").insert({ organization_id: organizationId, actor_user_id: user.id, subject_user_id: targetId, action: "view_file" });
  }

  return {
    profile: mapProfile(profile),
    dependents: (deps ?? []).map((d) => ({ id: d.id, fullName: d.full_name, relation: d.relation, dateOfBirth: d.date_of_birth ?? "", notes: d.notes ?? "" })),
    documents: (docs ?? []).map((d) => ({
      id: d.id, docType: d.doc_type, title: d.title, fileName: d.file_name, expiresOn: d.expires_on ?? "",
      uploadedByHr: d.uploaded_by !== targetId, createdAt: d.created_at,
    })),
  };
}

function validateCommon(f: EmployeeFileData): string | null {
  if (f.maritalStatus && !(MARITAL_STATUSES as readonly string[]).includes(f.maritalStatus)) return "Invalid marital status";
  if (f.personalEmail && !/^\S+@\S+\.\S+$/.test(f.personalEmail)) return "Enter a valid personal email";
  if (f.dateOfBirth && Number.isNaN(Date.parse(f.dateOfBirth))) return "Invalid date of birth";
  for (const v of Object.values(f)) if (v.length > 300) return "One of the fields is too long";
  return null;
}

// Employee edits their OWN file — only through the narrow RPC, which touches
// just the employee-editable columns (never hire date / employment type).
export async function saveMyEmployeeFile(f: EmployeeFileData): Promise<{ error: string } | { success: true }> {
  const invalid = validateCommon(f);
  if (invalid) return { error: invalid };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_employee_file", {
    p_legal_name: f.legalName, p_date_of_birth: f.dateOfBirth || null, p_gender: f.gender, p_nationality: f.nationality,
    p_national_id: f.nationalId, p_marital_status: f.maritalStatus, p_personal_phone: f.personalPhone, p_personal_email: f.personalEmail,
    p_address_line1: f.addressLine1, p_address_line2: f.addressLine2, p_city: f.city, p_region: f.region, p_postal_code: f.postalCode,
    p_country: f.country, p_emergency_contact_name: f.emergencyContactName, p_emergency_contact_relation: f.emergencyContactRelation,
    p_emergency_contact_phone: f.emergencyContactPhone,
  });
  if (error) {
    console.error("saveMyEmployeeFile failed:", error);
    return { error: "Could not save — the database may need migration 0181 run first." };
  }
  revalidatePath("/dashboard/my-file");
  return { success: true };
}

// HR edits anyone's file, including the HR-only hiring/employment fields.
export async function saveEmployeeFileAsAdmin(organizationId: string, userId: string, f: EmployeeFileData): Promise<{ error: string } | { success: true }> {
  const invalid = validateCommon(f);
  if (invalid) return { error: invalid };
  if (f.employmentType && !(EMPLOYMENT_TYPES as readonly string[]).includes(f.employmentType)) return { error: "Invalid employment type" };
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return { error: "Not authenticated" };

  const nz = (v: string) => (v.trim() === "" ? null : v.trim());
  const { data, error } = await supabase
    .from("employee_profiles")
    .upsert(
      {
        organization_id: organizationId, user_id: userId,
        legal_name: nz(f.legalName), date_of_birth: nz(f.dateOfBirth), gender: nz(f.gender), nationality: nz(f.nationality),
        national_id: nz(f.nationalId), marital_status: nz(f.maritalStatus), personal_phone: nz(f.personalPhone), personal_email: nz(f.personalEmail),
        address_line1: nz(f.addressLine1), address_line2: nz(f.addressLine2), city: nz(f.city), region: nz(f.region), postal_code: nz(f.postalCode),
        country: nz(f.country), emergency_contact_name: nz(f.emergencyContactName), emergency_contact_relation: nz(f.emergencyContactRelation),
        emergency_contact_phone: nz(f.emergencyContactPhone), hire_date: nz(f.hireDate), employment_type: nz(f.employmentType),
        probation_end_date: nz(f.probationEndDate), updated_by: user.id, updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" }
    )
    .select("id");
  if (error) {
    console.error("saveEmployeeFileAsAdmin failed:", error);
    return { error: "Could not save — the database may need migration 0181 run first." };
  }
  if (!data || data.length === 0) return { error: "Only a company admin can edit another person's file." };
  revalidatePath(`/dashboard/company/${userId}/file`);
  return { success: true };
}

export async function addDependent(
  organizationId: string,
  userId: string,
  d: { fullName: string; relation: string; dateOfBirth: string; notes: string }
): Promise<{ error: string } | { success: true; id: string }> {
  if (!d.fullName.trim()) return { error: "Name is required" };
  if (!(DEPENDENT_RELATIONS as readonly string[]).includes(d.relation)) return { error: "Invalid relation" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_dependents")
    .insert({ organization_id: organizationId, user_id: userId, full_name: d.fullName.trim().slice(0, 200), relation: d.relation, date_of_birth: d.dateOfBirth || null, notes: d.notes.trim().slice(0, 500) || null })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("addDependent failed:", error);
    return { error: "Could not add this family member." };
  }
  revalidatePath("/dashboard/my-file");
  revalidatePath(`/dashboard/company/${userId}/file`);
  return { success: true, id: data.id };
}

export async function removeDependent(id: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.from("employee_dependents").delete().eq("id", id);
  if (error) return { error: "Could not remove this family member." };
  revalidatePath("/dashboard/my-file");
  return { success: true };
}

// The browser uploads the file straight to the private bucket (path
// {org}/{employee}/{uuid}-{name}), then calls this to record it. Storage RLS
// is the gate on the bytes; the table's RLS decides who may record what
// (an employee can't record a contract / offer letter).
export async function attachEmployeeDocument(
  organizationId: string,
  userId: string,
  meta: { docType: string; title: string; storagePath: string; fileName: string; expiresOn: string }
): Promise<{ error: string } | { success: true }> {
  if (!(ALL_DOC_TYPES as readonly string[]).includes(meta.docType)) return { error: "Invalid document type" };
  if (!meta.title.trim()) return { error: "Give the document a title" };
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return { error: "Not authenticated" };
  if (!meta.storagePath.startsWith(`${organizationId}/${userId}/`)) return { error: "Invalid file location" };

  const { error } = await supabase.from("employee_documents").insert({
    organization_id: organizationId, user_id: userId, doc_type: meta.docType, title: meta.title.trim().slice(0, 200),
    storage_path: meta.storagePath, file_name: meta.fileName.slice(0, 255), expires_on: meta.expiresOn || null, uploaded_by: user.id,
  });
  if (error) {
    console.error("attachEmployeeDocument failed:", error);
    // Best-effort: don't leave an orphaned upload behind.
    await supabase.storage.from(EMPLOYEE_DOCUMENTS_BUCKET).remove([meta.storagePath]);
    return { error: (EMPLOYEE_DOC_TYPES as readonly string[]).includes(meta.docType) ? "Could not save this document." : "Only HR can add this type of document." };
  }
  revalidatePath("/dashboard/my-file");
  revalidatePath(`/dashboard/company/${userId}/file`);
  return { success: true };
}

// Short-lived signed URL. The table read is the gate (self or admin only);
// an admin opening someone else's document is logged.
export async function getEmployeeDocumentUrl(documentId: string): Promise<{ error: string } | { url: string }> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user) return { error: "Not authenticated" };
  const { data: doc } = await supabase
    .from("employee_documents")
    .select("organization_id, user_id, storage_path, title")
    .eq("id", documentId)
    .maybeSingle<{ organization_id: string; user_id: string; storage_path: string; title: string }>();
  if (!doc) return { error: "Document not found" };

  const { data, error } = await supabase.storage.from(EMPLOYEE_DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 300);
  if (error || !data) return { error: "Could not open this file — try again." };

  if (doc.user_id !== user.id) {
    await supabase.from("employee_file_access_log").insert({ organization_id: doc.organization_id, actor_user_id: user.id, subject_user_id: doc.user_id, action: "view_document", detail: doc.title.slice(0, 200) });
  }
  return { url: data.signedUrl };
}

export async function removeEmployeeDocument(documentId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("employee_documents")
    .select("user_id, storage_path")
    .eq("id", documentId)
    .maybeSingle<{ user_id: string; storage_path: string }>();
  if (!doc) return { error: "Document not found" };
  const { error } = await supabase.from("employee_documents").delete().eq("id", documentId);
  if (error) return { error: "You can only remove documents you uploaded yourself." };
  await supabase.storage.from(EMPLOYEE_DOCUMENTS_BUCKET).remove([doc.storage_path]);
  revalidatePath("/dashboard/my-file");
  revalidatePath(`/dashboard/company/${doc.user_id}/file`);
  return { success: true };
}

// Which optional sections this company collects. Any member can read (the
// employee's own page needs it); admins write via organizations' existing
// is_org_admin UPDATE policy, same as the directory toggle.
export async function getDisabledFileSections(organizationId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("disabled_file_sections")
    .eq("id", organizationId)
    .maybeSingle<{ disabled_file_sections: string[] | null }>();
  return data?.disabled_file_sections ?? [];
}

export async function setDisabledFileSections(organizationId: string, sections: string[]): Promise<{ error: string } | { success: true }> {
  const clean = [...new Set(sections)].filter(isFileSection);
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({ disabled_file_sections: clean }).eq("id", organizationId).select("id");
  if (error) {
    console.error("setDisabledFileSections failed:", error);
    return { error: "Could not save — the database may need migration 0181 run first." };
  }
  if (!data || data.length === 0) return { error: "Only a company admin can change this." };
  revalidatePath("/dashboard/my-file");
  revalidatePath("/dashboard/company/settings");
  return { success: true };
}
