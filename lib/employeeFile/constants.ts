// Plain constants shared by the employee-file server actions and its UI
// (a "use server" file can't export values). Free of "use server".

export const EMPLOYEE_DOCUMENTS_BUCKET = "employee-documents";

// Sections a company can choose to collect (organizations.disabled_file_sections,
// 0181). Employment details (hire date, type, probation) and the core personal
// block are always on.
export const FILE_SECTIONS = ["contact", "emergency", "family", "documents"] as const;
export type FileSection = (typeof FILE_SECTIONS)[number];

export function isFileSection(v: string): v is FileSection {
  return (FILE_SECTIONS as readonly string[]).includes(v);
}

export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "other"] as const;
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern", "other"] as const;
export const DEPENDENT_RELATIONS = ["spouse", "child", "parent", "sibling", "other"] as const;

// Contracts and offer letters are HR-only (the employee upload policy rejects
// them); everything else an employee can add for themselves.
export const HR_ONLY_DOC_TYPES = ["contract", "offer_letter"] as const;
export const EMPLOYEE_DOC_TYPES = ["national_id", "passport", "visa", "certificate", "other"] as const;
export const ALL_DOC_TYPES = [...HR_ONLY_DOC_TYPES, ...EMPLOYEE_DOC_TYPES] as const;

// The set of types a company can mark "required" (organizations.
// required_employee_doc_types, 0187) -- everything except "other", since
// requiring the catch-all type is meaningless. Matches this migration's
// own DB check constraint; keep the two in sync if this list ever changes.
export const REQUIRABLE_DOC_TYPES = ALL_DOC_TYPES.filter((t) => t !== "other");

export type EmployeeFileData = {
  legalName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalId: string;
  maritalStatus: string;
  personalPhone: string;
  personalEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  hireDate: string;
  employmentType: string;
  probationEndDate: string;
};

export const EMPTY_EMPLOYEE_FILE: EmployeeFileData = {
  legalName: "",
  dateOfBirth: "",
  gender: "",
  nationality: "",
  nationalId: "",
  maritalStatus: "",
  personalPhone: "",
  personalEmail: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  emergencyContactName: "",
  emergencyContactRelation: "",
  emergencyContactPhone: "",
  hireDate: "",
  employmentType: "",
  probationEndDate: "",
};

export type EmployeeDependent = { id: string; fullName: string; relation: string; dateOfBirth: string; notes: string };

// A dependent captured at invite time (0184) — no id/notes yet, since the
// row doesn't exist until apply_invite_file_data() creates it.
export type InviteDependentDraft = { fullName: string; relation: string; dateOfBirth: string };
export const EMPTY_INVITE_DEPENDENT: InviteDependentDraft = { fullName: "", relation: "", dateOfBirth: "" };

// An HR-defined document type (organization_document_types, 0188) beyond
// the 6 fixed ones -- e.g. "NDA". Its id IS the value stored in
// employee_documents.doc_type / organizations.required_employee_doc_types
// for a document of this type; the label is rendered verbatim, no i18n,
// same as organization_competencies.name.
export type OrgDocumentType = { id: string; label: string };

export type EmployeeDocument = {
  id: string;
  docType: string;
  title: string;
  fileName: string;
  expiresOn: string;
  uploadedByHr: boolean;
  createdAt: string;
};
