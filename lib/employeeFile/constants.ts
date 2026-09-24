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

export type EmployeeDocument = {
  id: string;
  docType: string;
  title: string;
  fileName: string;
  expiresOn: string;
  uploadedByHr: boolean;
  createdAt: string;
};
