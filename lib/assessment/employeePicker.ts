// Helpers for the "who can I assign this to" pickers. Not a server-action file, so plain functions are fine here.
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The title of each person's role in Job Architecture, or null when they have none yet. A person without a role cannot be
// given a role assessment or a knowledge check, so the pickers show this before anyone clicks Assign.
export async function roleTitlesFor(supabase: Supabase, organizationId: string, userIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>(userIds.map((id) => [id, null]));
  if (userIds.length === 0) return out;
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, current_role_id")
    .eq("organization_id", organizationId)
    .in("user_id", userIds)
    .returns<{ user_id: string; current_role_id: string | null }[]>();
  const roleIds = [...new Set((members ?? []).map((m) => m.current_role_id).filter((id): id is string => !!id))];
  if (roleIds.length === 0) return out;
  const { data: roles } = await supabase.from("job_roles").select("id, title").eq("organization_id", organizationId).in("id", roleIds).returns<{ id: string; title: string }[]>();
  const titleById = new Map((roles ?? []).map((r) => [r.id, r.title]));
  for (const m of members ?? []) out.set(m.user_id, (m.current_role_id && titleById.get(m.current_role_id)) || null);
  return out;
}

// When a person can next be given a role assessment: null if they can be given one now. Mirrors the retake rule in
// createAssessment (the newest assessment must be at least `intervalDays` old).
export function availableOn(lastCreatedAt: string | undefined, intervalDays: number, now: number = Date.now()): string | null {
  if (!lastCreatedAt || intervalDays <= 0) return null;
  const at = new Date(lastCreatedAt).getTime() + intervalDays * 86400000;
  return at > now ? new Date(at).toISOString() : null;
}
