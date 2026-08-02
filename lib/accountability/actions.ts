"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNTABILITY_FILES_BUCKET } from "./constants";
import type {
  AccountabilityGroup,
  AccountabilityGroupSummary,
  AccountabilityGroupMember,
  AccountabilityCheckin,
  AccountabilityCheckinReply,
  AccountabilityCheckinAttachment,
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
    .returns<Omit<AccountabilityCheckin, "full_name" | "avatar_url" | "replies" | "attachments">[]>();
  const checkinIds = (checkinRows ?? []).map((c) => c.id);

  const [{ data: replyRows }, { data: attachmentRows }] = checkinIds.length
    ? await Promise.all([
        supabase
          .from("accountability_checkin_replies")
          .select("*")
          .in("checkin_id", checkinIds)
          .order("created_at", { ascending: true })
          .returns<Omit<AccountabilityCheckinReply, "full_name" | "avatar_url">[]>(),
        supabase
          .from("accountability_checkin_attachments")
          .select("*")
          .in("checkin_id", checkinIds)
          .order("created_at", { ascending: true })
          .returns<AccountabilityCheckinAttachment[]>(),
      ])
    : [{ data: [] }, { data: [] }];

  const repliesByCheckin = new Map<string, AccountabilityCheckinReply[]>();
  for (const r of replyRows ?? []) {
    const list = repliesByCheckin.get(r.checkin_id) ?? [];
    list.push({ ...r, full_name: profiles.get(r.user_id)?.full_name ?? null, avatar_url: profiles.get(r.user_id)?.avatar_url ?? null });
    repliesByCheckin.set(r.checkin_id, list);
  }
  const attachmentsByCheckin = new Map<string, AccountabilityCheckinAttachment[]>();
  for (const a of attachmentRows ?? []) {
    const list = attachmentsByCheckin.get(a.checkin_id) ?? [];
    list.push(a);
    attachmentsByCheckin.set(a.checkin_id, list);
  }

  const checkins: AccountabilityCheckin[] = (checkinRows ?? []).map((c) => ({
    ...c,
    full_name: profiles.get(c.user_id)?.full_name ?? null,
    avatar_url: profiles.get(c.user_id)?.avatar_url ?? null,
    replies: repliesByCheckin.get(c.id) ?? [],
    attachments: attachmentsByCheckin.get(c.id) ?? [],
  }));

  return { group, members, checkins, isCreator: group.created_by === user.id };
}

export async function postAccountabilityReply(checkinId: string, groupId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "Write something before replying" };

  const { error } = await supabase.from("accountability_checkin_replies").insert({ checkin_id: checkinId, user_id: user.id, content: trimmed });
  if (error) return { error: "Could not reply — the database may need migration 0096 run first." };

  revalidatePath(`/dashboard/accountability/${groupId}`);
  return { success: true };
}

export async function deleteAccountabilityReply(replyId: string, groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("accountability_checkin_replies").delete().eq("id", replyId).eq("user_id", user.id);
  if (error) return { error: "Could not delete — try again." };

  revalidatePath(`/dashboard/accountability/${groupId}`);
  return { success: true };
}

// Called after the client has already uploaded the file directly to
// Storage (same split as Knowledge Hub uploads — see
// KnowledgeHubUploadForm.tsx) — this only persists the resulting path.
export async function createAccountabilityAttachment(input: {
  checkinId: string;
  groupId: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("accountability_checkin_attachments").insert({
    checkin_id: input.checkinId,
    uploaded_by: user.id,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size_bytes: input.fileSizeBytes,
    mime_type: input.mimeType,
  });
  if (error) return { error: "Could not attach file — the database may need migration 0096 run first." };

  revalidatePath(`/dashboard/accountability/${input.groupId}`);
  return { success: true };
}

export async function deleteAccountabilityAttachment(attachmentId: string, groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: attachment } = await supabase
    .from("accountability_checkin_attachments")
    .select("storage_path, uploaded_by")
    .eq("id", attachmentId)
    .maybeSingle<{ storage_path: string; uploaded_by: string }>();
  if (!attachment || attachment.uploaded_by !== user.id) return { error: "Could not delete — try again." };

  await supabase.storage.from(ACCOUNTABILITY_FILES_BUCKET).remove([attachment.storage_path]);
  const { error } = await supabase.from("accountability_checkin_attachments").delete().eq("id", attachmentId).eq("uploaded_by", user.id);
  if (error) return { error: "Could not delete — try again." };

  revalidatePath(`/dashboard/accountability/${groupId}`);
  return { success: true };
}

// Private bucket, so this is the only way to actually view/download a
// file — RLS on storage.objects independently re-checks membership
// (defense in depth), this just verifies the attachment row itself
// belongs to a checkin in a group the caller is in before minting the URL.
export async function getSignedAccountabilityFileUrl(attachmentId: string): Promise<{ error: string } | { url: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: attachment } = await supabase
    .from("accountability_checkin_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle<{ storage_path: string }>();
  if (!attachment) return { error: "File not found" };

  const { data, error } = await supabase.storage.from(ACCOUNTABILITY_FILES_BUCKET).createSignedUrl(attachment.storage_path, 300);
  if (error || !data) return { error: "Could not open this file — try again." };

  return { url: data.signedUrl };
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
