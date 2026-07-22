// Plain helper, not a server action — "use server" files may only export
// async functions, so this can't live in actions.ts alongside the things
// that import it.
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Short random suffix so two companies with the same display name
  // ("Acme") don't collide on the unique slug used as the join code.
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "company"}-${suffix}`;
}
