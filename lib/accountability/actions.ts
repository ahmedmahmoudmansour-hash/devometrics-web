"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  AccountabilityGroup,
  AccountabilityGroupSummary,
  AccountabilityGroupMember,
  AccountabilityCheckin,
} from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type MemberProfile = { user_id: string; full_name: string | null; avatar_url: string | null };
type GroupCodeMatch = { id: string; name: string; description: string | null; member_count: number };

function randomCode(): string {
  // Short, typeable code (not derived from the group name, unlike
  // organizations' slugify) — a study group's invite is shared verbally or
  // pasted, not looked up by name, so there's nothing to make memorable.
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function memberProfiles(supabase: SupabaseServerClient, groupId: string): Promise<Map<string, MemberProfile>> {
  const { data } = await supabase.rpc("get_accountability_group_member_profiles", { target_group_id: groupId });
  return new Map(((data as MemberProfile[] | null) ?? []).map((p) => [p.user_id, p]));
}

export async function listMyAccountabilityGroups(): Promise<{ groups: AccountabilityGroupSummary[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { groups: [] };

  const { data: memberships, error: membershipError } = await supabase
    .from("accountability_group_members")
    .select("group_id")
    .eq("user_id", user.id)
    .returns<{ group_id: string }[]>();
  if (membershipError) return { groups: [], error: "not_migrated" };

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) return { groups: [] };

  const { data: groups } = await supabase
    .from("accountability_groups")
    .select("*")
    .in("id", groupIds)
    .returns<AccountabilityGroup[]>();

  const { data: allMembers } = await supabase
    .from("accountability_group_members")
    .select("group_id")
    .in("group_id", groupIds)
    .returns<{ group_id: string }[]>();
  const countByGroup = new Map<string, number>();
  for (const m of allMembers ?? []) countByGroup.set(m.group_id, (countByGroup.get(m.group_id) ?? 0) + 1);

  const { data: checkins } = await supabase
    .from("accountability_checkins")
    .select("group_id, created_at")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .returns<{ group_id: string; created_at: string }[]>();
  const latestByGroup = new Map<string, string>();
  for (const c of checkins ?? []) {
    if (!latestByGroup.has(c.group_id)) latestByGroup.set(c.group_id, c.created_at);
  }

  const summaries: AccountabilityGroupSummary[] = (groups ?? []).map((g) => ({
    ...g,
    member_count: countByGroup.get(g.id) ?? 0,
    latest_checkin: latestByGroup.get(g.id) ?? null,
  }));
  summaries.sort((a, b) => (b.latest_checkin ?? b.created_at).localeCompare(a.latest_checkin ?? a.created_at));

  return { groups: summaries };
}

export async function createAccountabilityGroup(name: string, description?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Give the group a name" };

  let group: AccountabilityGroup | null = null;
  // Up to 3 tries against the unique invite_code constraint — a collision on
  // a 6-char base-36 code is astronomically unlikely, this just makes the
  // rare case a retry instead of a hard failure.
  for (let attempt = 0; attempt < 3 && !group; attempt++) {
    const { data, error } = await supabase
      .from("accountability_groups")
      .insert({ name: trimmed, description: description?.trim() || null, created_by: user.id, invite_code: randomCode() })
      .select()
      .maybeSingle<AccountabilityGroup>();
    if (data) group = data;
    else if (error && !error.message.includes("duplicate")) {
      console.error("createAccountabilityGroup insert failed:", error);
      return { error: "Could not create group — try again." };
    }
  }
  if (!group) return { error: "Could not create group — try again." };

  const { error: memberError } = await supabase
    .from("accountability_group_members")
    .insert({ group_id: group.id, user_id: user.id });
  if (memberError) {
    console.error("createAccountabilityGroup member insert failed:", memberError);
    return { error: "Group created, but could not add you as a member — try rejoining with the invite code." };
  }

  revalidatePath("/dashboard/accountability");
  return { success: true, group };
}

export async function previewAccountabilityGroup(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { error: "Enter an invite code" };

  const { data } = await supabase.rpc("find_accountability_group_by_code", { code: trimmed });
  const match = (data as GroupCodeMatch[] | null)?.[0];
  if (!match) return { error: "No group found with that code" };

  return { success: true, group: match };
}

export async function joinAccountabilityGroup(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = code.trim().toUpperCase();
  const { data } = await supabase.rpc("find_accountability_group_by_code", { code: trimmed });
  const match = (data as GroupCodeMatch[] | null)?.[0];
  if (!match) return { error: "No group found with that code" };

  const { error } = await supabase.from("accountability_group_members").insert({ group_id: match.id, user_id: user.id });
  if (error) return { error: "Could not join — you may already be a member." };

  revalidatePath("/dashboard/accountability");
  return { success: true, groupId: match.id };
}

export async function leaveAccountabilityGroup(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("accountability_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) return { error: "Could not leave — try again." };

  revalidatePath("/dashboard/accountability");
  return { success: true };
}

export async function getAccountabilityGroupDetail(groupId: string): Promise<{
  group: AccountabilityGroup | null;
  members: AccountabilityGroupMember[];
  checkins: AccountabilityCheckin[];
  isCreator: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { group: null, members: [], checkins: [], isCreator: false };

  const { data: group } = await supabase
    .from("accountability_groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle<AccountabilityGroup>();
  if (!group) return { group: null, members: [], checkins: [], isCreator: false };

  const profiles = await memberProfiles(supabase, groupId);

  const { data: memberRows } = await supabase
    .from("accountability_group_members")
    .select("group_id, user_id, joined_at")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true })
    .returns<{ group_id: string; user_id: string; joined_at: string }[]>();
  const members: AccountabilityGroupMember[] = (memberRows ?? []).map((m) => ({
    ...m,
    full_name: profiles.get(m.user_id)?.full_name ?? null,
    avatar_url: profiles.get(m.user_id)?.avatar_url ?? null,
  }));

  const { data: checkinRows } = await supabase
    .from("accountability_checkins")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AccountabilityCheckin[]>();
  const checkins: AccountabilityCheckin[] = (checkinRows ?? []).map((c) => ({
    ...c,
    full_name: profiles.get(c.user_id)?.full_name ?? null,
    avatar_url: profiles.get(c.user_id)?.avatar_url ?? null,
  }));

  return { group, members, checkins, isCreator: group.created_by === user.id };
}

export async function postAccountabilityCheckin(groupId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "Write something before posting" };

  const { error } = await supabase.from("accountability_checkins").insert({ group_id: groupId, user_id: user.id, content: trimmed });
  if (error) return { error: "Could not post — try again." };

  revalidatePath(`/dashboard/accountability/${groupId}`);
  return { success: true };
}

export async function deleteAccountabilityCheckin(checkinId: string, groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("accountability_checkins").delete().eq("id", checkinId).eq("user_id", user.id);
  if (error) return { error: "Could not delete — try again." };

  revalidatePath(`/dashboard/accountability/${groupId}`);
  return { success: true };
}
