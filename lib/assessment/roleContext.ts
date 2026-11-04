// The role a saved question set was written for. Questions are reused for everyone in the same role, never across roles
// (migration 0206). Lowercase, single-spaced, at most 120 characters, so "HR  Generalist" and "hr generalist" are one role.
export const ROLE_CONTEXT_MAX = 120;

export function roleContextKey(title: string | null | undefined): string {
  return (title ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, ROLE_CONTEXT_MAX);
}
