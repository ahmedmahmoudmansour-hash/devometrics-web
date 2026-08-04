"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import type { OrgChartViewConfig, OrgChartPresetKey } from "./cardConfig";

const MAX_NAME = 120;
const REVALIDATE_PATH = "/dashboard/company/org-chart";

// Everything a saved view stores. presetKey is purely descriptive metadata
// ("this was saved starting from Executive") — it's never re-derived or
// validated against the current preset definitions, so a saved view keeps
// showing exactly what was saved even if a preset's own defaults change
// later (same snapshot discipline as every other template/instance split
// in this app).
export type SavedOrgChartConfig = OrgChartViewConfig & { presetKey: OrgChartPresetKey | null };

export type OrgChartSavedView = {
  id: string;
  name: string;
  config: SavedOrgChartConfig;
  createdAt: string;
};

export async function listSavedViews(): Promise<OrgChartSavedView[]> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return [];
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("org_chart_saved_views")
    .select("id, name, config, created_at")
    .eq("organization_id", data.organizationId)
    .order("created_at", { ascending: true })
    .returns<{ id: string; name: string; config: SavedOrgChartConfig; created_at: string }[]>();
  return (rows ?? []).map((r) => ({ id: r.id, name: r.name, config: r.config, createdAt: r.created_at }));
}

export async function createSavedView(name: string, config: SavedOrgChartConfig) {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) return { error: "Give this view a name" };

  const { error } = await supabase.from("org_chart_saved_views").insert({
    organization_id: data.organizationId,
    name: trimmed,
    config,
    created_by: user.id,
  });
  if (error) return { error: "Could not save this view — the database may need migration 0105 run first." };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function updateSavedView(id: string, name: string, config: SavedOrgChartConfig) {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();

  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) return { error: "Give this view a name" };

  const { error } = await supabase
    .from("org_chart_saved_views")
    .update({ name: trimmed, config })
    .eq("id", id)
    .eq("organization_id", data.organizationId);
  if (error) return { error: "Could not update this view — try again." };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function deleteSavedView(id: string) {
  const supabase = await createClient();
  // RLS restricts this to admins of the view's own org — a non-admin's or
  // wrong-org delete simply matches zero rows.
  await supabase.from("org_chart_saved_views").delete().eq("id", id);
  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
