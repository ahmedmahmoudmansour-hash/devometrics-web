// Plain constants/types shared by lib/organizations/featureAccess.ts (a
// "use server" file, which can only export async functions) and any client
// component that needs them. Keep this file free of "use server" and free
// of anything that isn't a plain value or type.

// Curated, deliberately small set — every entry here needs a real gate
// wired into its page(s) and server action(s). Adding a key to this list
// alone does nothing; see lib/organizations/featureAccess.ts's callers for
// the actual enforcement points.
export const RESTRICTABLE_FEATURES = [
  "ai_coaching",
  "roleplay",
  "resume_intelligence",
  "career_development",
  "knowledge_hub",
  "job_architecture",
  "competency_management",
  "performance_review",
] as const;
export type RestrictableFeature = (typeof RESTRICTABLE_FEATURES)[number];

export function isRestrictableFeature(v: string): v is RestrictableFeature {
  return (RESTRICTABLE_FEATURES as readonly string[]).includes(v);
}

export type FeatureRestrictionRow = {
  id: string;
  featureKey: RestrictableFeature;
  scopeType: "user" | "department";
  userId: string | null;
  userName: string | null;
  department: string | null;
};
