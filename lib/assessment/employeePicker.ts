// Helpers for the "who can I assign this to" pickers. Not a server-action file, so plain functions are fine here.
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PickerRole = { id: string; title: string; level: string; grade: number };

// For each person: the title of their role in Job Architecture (null when they have none yet) and their membership id (needed
// to give them a role). A person without a role cannot be given a role assessment or a knowledge check, so the pickers show
// this before anyone clicks Assign and let an admin fix it on the spot. Also returns the company's roles to choose from.
export async function pickerInfo(
  supabase: Supabase,
  organizationId: string,
  userIds: string[]
): Promise<{ roleTitles: Map<string, string | null>; memberIds: Map<string, string>; roles: PickerRole[] }> {
  const roleTitles = new Map<string, string | null>(userIds.map((id) => [id, null]));
  const memberIds = new Map<string, string>();
  const { data: roleRows } = await supabase
    .from("job_roles")
    .select("id, title, level, grade")
    .eq("organization_id", organizationId)
    .order("grade", { ascending: false })
    .returns<PickerRole[]>();
  const roles = roleRows ?? [];
  if (userIds.length === 0) return { roleTitles, memberIds, roles };
  const { data: members } = await supabase
    .from("organization_members")
    .select("id, user_id, current_role_id")
    .eq("organization_id", organizationId)
    .in("user_id", userIds)
    .returns<{ id: string; user_id: string; current_role_id: string | null }[]>();
  const titleById = new Map(roles.map((r) => [r.id, r.title]));
  for (const m of members ?? []) {
    memberIds.set(m.user_id, m.id);
    roleTitles.set(m.user_id, (m.current_role_id && titleById.get(m.current_role_id)) || null);
  }
  return { roleTitles, memberIds, roles };
}

// When a person can next be given a role assessment: null if they can be given one now. Mirrors the retake rule in
// createAssessment (the newest assessment must be at least `intervalDays` old).
export function availableOn(lastCreatedAt: string | undefined, intervalDays: number, now: number = Date.now()): string | null {
  if (!lastCreatedAt || intervalDays <= 0) return null;
  const at = new Date(lastCreatedAt).getTime() + intervalDays * 86400000;
  return at > now ? new Date(at).toISOString() : null;
}
