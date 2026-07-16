"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import type { ScorecardPerspective, ScorecardKpiStatus } from "@/lib/supabase/types";

const MAX_NAME = 160;
const MAX_VALUE = 60;
const MAX_NOTE = 500;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, organizationId: null };
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { supabase, user: null, organizationId: null };
  return { supabase, user, organizationId: data.organizationId };
}

export async function createScorecardKpi(
  perspective: ScorecardPerspective,
  fields: { name: string; target: string; actual: string; status: ScorecardKpiStatus; note: string }
) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const name = fields.name.trim().slice(0, MAX_NAME);
  if (!name) return { error: "Give the KPI a name" };

  const { error } = await supabase.from("scorecard_kpis").insert({
    organization_id: organizationId,
    perspective,
    name,
    target: fields.target.trim().slice(0, MAX_VALUE),
    actual: fields.actual.trim().slice(0, MAX_VALUE),
    status: fields.status,
    note: fields.note.trim().slice(0, MAX_NOTE),
    created_by: user.id,
  });
  if (error) {
    console.error("createScorecardKpi failed:", error);
    return { error: "Could not save — the database may need migration 0070 run first." };
  }
  revalidatePath("/dashboard/company/scorecard");
  return { success: true };
}

export async function updateScorecardKpi(
  kpiId: string,
  fields: { name: string; target: string; actual: string; status: ScorecardKpiStatus; note: string }
) {
  const { supabase, organizationId } = await requireAdmin();
  if (!organizationId) return { error: "Not authorized" };

  const name = fields.name.trim().slice(0, MAX_NAME);
  if (!name) return { error: "Give the KPI a name" };

  const { error } = await supabase
    .from("scorecard_kpis")
    .update({
      name,
      target: fields.target.trim().slice(0, MAX_VALUE),
      actual: fields.actual.trim().slice(0, MAX_VALUE),
      status: fields.status,
      note: fields.note.trim().slice(0, MAX_NOTE),
      updated_at: new Date().toISOString(),
    })
    .eq("id", kpiId);
  if (error) return { error: "Could not update — try again." };

  revalidatePath("/dashboard/company/scorecard");
  return { success: true };
}

export async function deleteScorecardKpi(kpiId: string) {
  const { supabase, organizationId } = await requireAdmin();
  if (!organizationId) return { error: "Not authorized" };

  // RLS restricts this to admins of the KPI's own org — a non-admin's
  // delete simply matches zero rows.
  await supabase.from("scorecard_kpis").delete().eq("id", kpiId);
  revalidatePath("/dashboard/company/scorecard");
  return { success: true };
}
