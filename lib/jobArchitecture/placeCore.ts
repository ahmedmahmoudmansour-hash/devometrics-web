// Checking an uploaded list of "this person holds this job" before anything is written. Pure, so it is tested without a database. The
// browser only reads the file; the server re-checks every row with these same rules and does the writing.

export type PlaceRow = { email: string; title: string; family: string };
export type PlaceRowResult = { status: "ok" | "unchanged" | "error"; message?: string };

export const MAX_ROWS = 500;

export type PlaceMember = { memberId: string; email: string; currentRoleId: string | null };
export type PlaceRole = { id: string; title: string; family: string };

export type PlaceValidation = {
  results: PlaceRowResult[];
  // aligned with the input rows; null where nothing is to be written
  changes: ({ memberId: string; roleId: string } | null)[];
  ok: number;
  unchanged: number;
  errors: number;
};

const norm = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePlacements(rows: PlaceRow[], members: PlaceMember[], roles: PlaceRole[]): PlaceValidation {
  const byEmail = new Map(members.map((m) => [norm(m.email), m]));
  const rolesByTitle = new Map<string, PlaceRole[]>();
  for (const r of roles) rolesByTitle.set(norm(r.title), [...(rolesByTitle.get(norm(r.title)) ?? []), r]);

  const results: PlaceRowResult[] = [];
  const changes: PlaceValidation["changes"] = [];
  const seen = new Map<string, string>(); // email -> role id already planned in this file

  for (const raw of rows) {
    const email = norm(raw.email);
    const title = norm(raw.title);
    const family = norm(raw.family);
    const fail = (message: string) => {
      results.push({ status: "error", message });
      changes.push(null);
    };
    if (!email) { fail("Email is missing"); continue; }
    if (!EMAIL.test(email)) { fail("That is not an email address"); continue; }
    if (!title) { fail("Job title is missing"); continue; }
    const member = byEmail.get(email);
    if (!member) { fail("No one with this email is in your company"); continue; }

    const candidates = rolesByTitle.get(title) ?? [];
    if (candidates.length === 0) { fail("No job with this title in your Job Architecture"); continue; }
    let role: PlaceRole | undefined;
    if (candidates.length === 1) {
      role = candidates[0];
      if (family && norm(role.family) !== family) { fail(`The job "${role.title}" is in ${role.family}, not ${raw.family.trim()}`); continue; }
    } else {
      // The same title in more than one family: the family column decides.
      const inFamily = candidates.filter((c) => norm(c.family) === family);
      if (!family) { fail(`More than one job is called "${candidates[0].title}": add its family (${candidates.map((c) => c.family).join(", ")})`); continue; }
      if (inFamily.length !== 1) { fail(`No job "${candidates[0].title}" in the family ${raw.family.trim()}`); continue; }
      role = inFamily[0];
    }

    const planned = seen.get(email);
    if (planned !== undefined && planned !== role.id) { fail("This person is listed with two different jobs in this file"); continue; }
    seen.set(email, role.id);
    if (planned === role.id) {
      results.push({ status: "unchanged", message: "Listed twice in this file" });
      changes.push(null);
      continue;
    }
    if (member.currentRoleId === role.id) {
      results.push({ status: "unchanged", message: "Already in this job" });
      changes.push(null);
      continue;
    }
    results.push({ status: "ok" });
    changes.push({ memberId: member.memberId, roleId: role.id });
  }
  return {
    results,
    changes,
    ok: results.filter((r) => r.status === "ok").length,
    unchanged: results.filter((r) => r.status === "unchanged").length,
    errors: results.filter((r) => r.status === "error").length,
  };
}
