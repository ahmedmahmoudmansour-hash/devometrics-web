"use server";

import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import type { OrgChartAnnotation } from "./cardConfig";

// One always-on set of free-text notes per org — not per saved view, see
// cardConfig.ts's comment on OrgChartAnnotation for why this lives in its
// own table (org_chart_annotations, migration 0125) instead of riding along
// in org_chart_saved_views' config.
export async function loadOrgChartAnnotations(): Promise<OrgChartAnnotation[]> {
  const data = await buildCompanyData();
  if (!data.organizationId) return [];
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("org_chart_annotations")
    .select("annotations")
    .eq("organization_id", data.organizationId)
    .maybeSingle<{ annotations: OrgChartAnnotation[] }>();
  return row?.annotations ?? [];
}

// Whole-array upsert, not a per-note patch — annotation counts are small
// (a handful of sticky notes, not hundreds), so writing the full current
// array on every change is simpler than diffing, and the client is already
// the source of truth for the full list at the moment it calls this.
export async function saveOrgChartAnnotations(annotations: OrgChartAnnotation[]): Promise<{ error?: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("org_chart_annotations")
    .upsert(
      { organization_id: data.organizationId, annotations, updated_at: new Date().toISOString() },
      { onConflict: "organization_id" }
    );
  if (error) {
    console.error("saveOrgChartAnnotations failed:", error);
    return { error: "Could not save your note — the database may need migration 0125 run first." };
  }
  return {};
}
