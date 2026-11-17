// Checking an uploaded list of job titles and levels before anything is written. Pure, so it is tested without a database.
// The browser only reads the file; the server re-checks everything with these same rules and does the writing.

export type RolesImportRow = {
  family: string; // job family or department; blank means "General"
  title: string;
  level: string; // free label such as Entry, Mid, Senior, Lead, Manager, Head
  grade: string; // 1 to 10
  track: string; // IC / Individual contributor / Management
  responsibilities: string;
};

export type RolesImportRowResult = { status: "ok" | "duplicate" | "error"; message?: string };

export type RoleTrackValue = "ic" | "management";

export const MAX_ROWS = 500;
export const MAX_TITLE = 120;
export const MAX_FAMILY = 120;
export const MAX_LEVEL = 40;
export const MAX_RESPONSIBILITIES = 4000;
export const DEFAULT_FAMILY = "General";

export type ValidRole = { family: string; title: string; level: string; grade: number; track: RoleTrackValue; responsibilities: string };

export const keyOf = (family: string, title: string) => `${family.trim().toLowerCase().replace(/\s+/g, " ")}||${title.trim().toLowerCase().replace(/\s+/g, " ")}`;

// "5", "G5", "Grade 5", "grade-5", 5.0 are all grade 5. Anything else, or outside 1 to 10, is not a grade.
export function parseGrade(raw: string): number | null {
  const m = /^(?:(?:g|grade)[\s\-_.]*)?([0-9]{1,2})(?:\.0+)?$/i.exec(String(raw ?? "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 10 ? n : null;
}

export function parseTrack(raw: string): RoleTrackValue | null {
  const v = String(raw ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (v === "") return "ic";
  if (["ic", "individualcontributor", "individual", "specialist", "professional", "technical", "contributor"].includes(v)) return "ic";
  if (["management", "manager", "managerial", "mgmt", "leadership", "people"].includes(v)) return "management";
  return null;
}

export type RolesValidation = {
  results: RolesImportRowResult[];
  roles: (ValidRole | null)[]; // aligned with the input rows; null for a row that cannot be imported
  newFamilies: string[]; // families that do not exist yet and would be created
  ok: number;
  duplicates: number;
  errors: number;
};

// existing: "family||title" keys of roles the company already has, and the names of its families (lower case).
export function validateRoleRows(rows: RolesImportRow[], existingRoleKeys: Set<string>, existingFamilyNames: Set<string>): RolesValidation {
  const results: RolesImportRowResult[] = [];
  const roles: (ValidRole | null)[] = [];
  const seen = new Set<string>();
  const newFamilies = new Map<string, string>(); // lower-case key -> name as first written

  for (const raw of rows) {
    const family = (raw.family ?? "").trim().replace(/\s+/g, " ") || DEFAULT_FAMILY;
    const title = (raw.title ?? "").trim().replace(/\s+/g, " ");
    const level = (raw.level ?? "").trim().replace(/\s+/g, " ");
    const responsibilities = (raw.responsibilities ?? "").trim();
    const fail = (message: string) => {
      results.push({ status: "error", message });
      roles.push(null);
    };
    if (!title) { fail("Job title is missing"); continue; }
    if (title.length > MAX_TITLE) { fail(`Job title is longer than ${MAX_TITLE} characters`); continue; }
    if (family.length > MAX_FAMILY) { fail(`Family is longer than ${MAX_FAMILY} characters`); continue; }
    if (level.length > MAX_LEVEL) { fail(`Level is longer than ${MAX_LEVEL} characters`); continue; }
    if (responsibilities.length > MAX_RESPONSIBILITIES) { fail(`Responsibilities are longer than ${MAX_RESPONSIBILITIES} characters`); continue; }
    const grade = parseGrade(raw.grade);
    if (grade === null) { fail("Grade must be a number from 1 to 10"); continue; }
    const track = parseTrack(raw.track);
    if (track === null) { fail("Track must be IC (individual contributor) or Management"); continue; }

    const key = keyOf(family, title);
    if (seen.has(key)) {
      results.push({ status: "duplicate", message: "Listed twice in this file" });
      roles.push(null);
      continue;
    }
    seen.add(key);
    if (existingRoleKeys.has(key)) {
      results.push({ status: "duplicate", message: "Already in your Job Architecture" });
      roles.push(null);
      continue;
    }
    const familyKey = family.toLowerCase();
    if (!existingFamilyNames.has(familyKey) && !newFamilies.has(familyKey)) newFamilies.set(familyKey, family);
    results.push({ status: "ok" });
    roles.push({ family, title, level, grade, track, responsibilities });
  }
  return {
    results,
    roles,
    newFamilies: [...newFamilies.values()],
    ok: results.filter((r) => r.status === "ok").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    errors: results.filter((r) => r.status === "error").length,
  };
}
