"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminOrganizationRow = {
  id: string;
  name: string;
  memberCount: number;
  seatLimit: number | null;
};

// Platform-admin-only: how many seats each company has, and how many
// they're actually using. Relies on organizations' existing "any
// authenticated user can look up" SELECT policy (0016) for the org list
// itself, and a plain count query per org for headcount — this app has no
// service-role key, so there's no single aggregate query that bypasses RLS
// here.
export async function buildAdminOrganizations(): Promise<{ isAdmin: boolean; rows: AdminOrganizationRow[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, rows: [] };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { isAdmin: false, rows: [] };

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, seat_limit")
    .order("name", { ascending: true })
    .returns<{ id: string; name: string; seat_limit: number | null }[]>();
  if (!orgs || orgs.length === 0) return { isAdmin: true, rows: [] };

  const { data: members } = await supabase
    .from("organization_members")
    .select("organization_id")
    .in("organization_id", orgs.map((o) => o.id))
    .returns<{ organization_id: string }[]>();
  const countByOrg = new Map<string, number>();
  for (const m of members ?? []) countByOrg.set(m.organization_id, (countByOrg.get(m.organization_id) ?? 0) + 1);

  const rows: AdminOrganizationRow[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    memberCount: countByOrg.get(o.id) ?? 0,
    seatLimit: o.seat_limit,
  }));

  return { isAdmin: true, rows };
}

// null clears the limit back to unlimited.
export async function updateOrgSeatLimit(organizationId: string, seatLimit: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();
  if (!ownProfile?.is_admin) return { error: "Not authorized" };

  if (seatLimit !== null && (!Number.isInteger(seatLimit) || seatLimit < 0)) {
    return { error: "Seat limit must be a whole number, or blank for unlimited" };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ seat_limit: seatLimit })
    .eq("id", organizationId);
  if (error) {
    console.error("updateOrgSeatLimit failed:", error);
    return { error: "Could not update — the database may need migration 0079 run first." };
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}
