"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Employee directory (0175) — deliberately thin. The real access control
// lives inside the two SECURITY DEFINER functions this calls
// (list_directory_entries / update_my_contact_info): both re-check
// membership and the org's opt-in flag themselves, so this file never has
// to duplicate that logic or trust a caller-supplied organization id.

export type DirectoryEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  email: string;
  title: string | null;
  department: string | null;
  phone: string | null;
  mobilePhone: string | null;
  extension: string | null;
  managerName: string | null;
  managerEmail: string | null;
};

type RawDirectoryEntry = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  title: string | null;
  department: string | null;
  phone: string | null;
  mobile_phone: string | null;
  extension: string | null;
  manager_name: string | null;
  manager_email: string | null;
};

// Empty when directory_enabled is off for this org, or the caller isn't an
// active member — list_directory_entries itself returns zero rows rather
// than erroring in either case, so there's nothing extra to branch on here.
export async function listDirectoryEntries(organizationId: string): Promise<DirectoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_directory_entries", { check_org_id: organizationId });
  if (error || !data) return [];
  return (data as RawDirectoryEntry[]).map((r) => ({
    userId: r.user_id,
    name: r.full_name ?? "—",
    avatarUrl: r.avatar_url,
    email: r.email ?? "—",
    title: r.title,
    department: r.department,
    phone: r.phone,
    mobilePhone: r.mobile_phone,
    extension: r.extension,
    managerName: r.manager_name,
    managerEmail: r.manager_email,
  }));
}

export async function updateMyContactInfo(fields: {
  phone: string;
  mobilePhone: string;
  extension: string;
}): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_contact_info", {
    p_phone: fields.phone,
    p_mobile_phone: fields.mobilePhone,
    p_extension: fields.extension,
  });
  if (error) {
    console.error("updateMyContactInfo failed:", error);
    return { error: "Could not save your contact info — the database may need migration 0175 run first." };
  }
  revalidatePath("/dashboard/directory");
  return { success: true };
}

// ============================================================
// Org-level opt-in toggle — same direct .from("organizations") pattern as
// getLeaveManagerVisibility/setLeaveManagerVisibility (lib/leave/actions.ts),
// protected by organizations' existing is_org_admin UPDATE policy.
// ============================================================

export async function getDirectoryEnabled(organizationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("directory_enabled")
    .eq("id", organizationId)
    .maybeSingle<{ directory_enabled: boolean | null }>();
  return !!data?.directory_enabled;
}

export async function setDirectoryEnabled(organizationId: string, enabled: boolean): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ directory_enabled: enabled }).eq("id", organizationId);
  if (error) {
    console.error("setDirectoryEnabled failed:", error);
    return { error: "Could not save this setting — the database may need migration 0175 run first." };
  }
  revalidatePath("/dashboard/company/settings");
  revalidatePath("/dashboard/directory");
  return { success: true };
}
