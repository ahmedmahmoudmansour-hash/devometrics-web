import { MARITAL_STATUSES, EMPLOYMENT_TYPES, type EmployeeFileData } from "@/lib/employeeFile/constants";

// Employee-file fields HR can fill in at invite time. Keys are the
// employee_profiles column names, which is what apply_invite_file_data (0183)
// reads back out of organization_invites.file_data when the person joins.
const COLUMN_FOR_FIELD: Record<keyof EmployeeFileData, string> = {
  legalName: "legal_name",
  dateOfBirth: "date_of_birth",
  gender: "gender",
  nationality: "nationality",
  nationalId: "national_id",
  maritalStatus: "marital_status",
  personalPhone: "personal_phone",
  personalEmail: "personal_email",
  addressLine1: "address_line1",
  addressLine2: "address_line2",
  city: "city",
  region: "region",
  postalCode: "postal_code",
  country: "country",
  emergencyContactName: "emergency_contact_name",
  emergencyContactRelation: "emergency_contact_relation",
  emergencyContactPhone: "emergency_contact_phone",
  hireDate: "hire_date",
  employmentType: "employment_type",
  probationEndDate: "probation_end_date",
};

const DATE_FIELDS: (keyof EmployeeFileData)[] = ["dateOfBirth", "hireDate", "probationEndDate"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Returns the cleaned jsonb to store, null when HR entered nothing, or an
// error message for the first invalid value (so a typo is caught at invite
// time instead of silently dropped when the person joins).
export function sanitizeInviteFileData(input: Partial<EmployeeFileData> | undefined): { data: Record<string, string> | null } | { error: string } {
  if (!input) return { data: null };
  const out: Record<string, string> = {};
  for (const [field, column] of Object.entries(COLUMN_FOR_FIELD) as [keyof EmployeeFileData, string][]) {
    const raw = input[field];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (!value) continue;
    if (value.length > 300) return { error: "One of the employee details is too long." };
    if (DATE_FIELDS.includes(field) && !isRealIsoDate(value)) return { error: "Dates must be real dates in YYYY-MM-DD form." };
    if (field === "maritalStatus" && !(MARITAL_STATUSES as readonly string[]).includes(value)) return { error: "Invalid marital status." };
    if (field === "employmentType" && !(EMPLOYMENT_TYPES as readonly string[]).includes(value)) return { error: "Invalid employment type." };
    if (field === "personalEmail" && !/^\S+@\S+\.\S+$/.test(value)) return { error: "Enter a valid personal email." };
    out[column] = value;
  }
  return { data: Object.keys(out).length ? out : null };
}
