// One definition of "has left the company", so every screen agrees with the database (migration 0215).
// The app has two ways to mark a leaver: "Archive" (organization_members.archived) and a resigned or terminated employment status
// (organization_members.employment_status, 0172). Neither sets the other, so a check that looks at only one lets the other kind through.
// A missing status counts as active, because the column's default is 'active'.
export type LeaverFields = { archived?: boolean | null; employment_status?: string | null };

export function hasLeft(m: LeaverFields): boolean {
  if (m.archived) return true;
  const status = m.employment_status;
  return status !== undefined && status !== null && status !== "active";
}
