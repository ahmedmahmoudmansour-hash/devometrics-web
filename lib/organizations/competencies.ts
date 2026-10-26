"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { suggestCompetencyDimension } from "./suggestDimension";
import { getMyOrganizationMembership } from "./actions";
import { listMyRestrictedFeatures } from "./featureAccess";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";
import { resolveCallerLocale } from "@/lib/i18n/request";
import { cleanLevelIndicators, isCompetencyCategory, type CompetencyCategory } from "@/lib/proficiency/library";

// Bounded: the name/description also go into an AI prompt.
const MAX_COMPETENCY_NAME = 120;
const MAX_COMPETENCY_DESCRIPTION = 1000;

function isValidDimension(value: string): value is CompetencyDimension {
  return (COMPETENCY_DIMENSIONS as readonly string[]).includes(value);
}

// Lets an org admin add one of their own named competencies (their own
// language/description), optionally mapped onto one of the 8 fixed
// dimensions that actually drive scoring — this is a translation layer, not
// a second scoring system. Mapping is optional: some competencies (pure
// values statements like "Integrity") don't cleanly fit any dimension, and
// forcing one produced noisy, meaningless scores.
export async function createOrganizationCompetency(
  organizationId: string,
  fields: { name: string; description?: string; mappedDimension: string | null; category?: CompetencyCategory; levelIndicators?: Record<string, string> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("competency_management")) {
    return { error: "Competency Management has been restricted for your account by your company administrator." };
  }

  const name = fields.name.trim().slice(0, MAX_COMPETENCY_NAME);
  if (!name) return { error: "Competency name is required" };
  if (fields.mappedDimension !== null && !isValidDimension(fields.mappedDimension)) {
    return { error: "Invalid dimension" };
  }

  if (fields.category !== undefined && !isCompetencyCategory(fields.category)) return { error: "Invalid type" };

  const { error } = await supabase.from("organization_competencies").insert({
    organization_id: organizationId,
    name,
    description: fields.description?.trim().slice(0, MAX_COMPETENCY_DESCRIPTION) || null,
    mapped_dimension: fields.mappedDimension,
    // Library fields (0203): only sent when given, so a plain add still works.
    ...(fields.category ? { category: fields.category } : {}),
    ...(fields.levelIndicators ? { level_indicators: cleanLevelIndicators(fields.levelIndicators) } : {}),
  });
  if (error) return { error: "Could not save competency — try again" };

  revalidatePath("/dashboard/company");
  return { success: true };
}

export async function updateOrganizationCompetency(
  id: string,
  fields: { name: string; description?: string; mappedDimension: string | null; category?: CompetencyCategory; levelIndicators?: Record<string, string> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = fields.name.trim().slice(0, MAX_COMPETENCY_NAME);
  if (!name) return { error: "Competency name is required" };
  if (fields.mappedDimension !== null && !isValidDimension(fields.mappedDimension)) {
    return { error: "Invalid dimension" };
  }
  if (fields.category !== undefined && !isCompetencyCategory(fields.category)) return { error: "Invalid type" };

  const { error } = await supabase
    .from("organization_competencies")
    .update({
      name,
      description: fields.description?.trim().slice(0, MAX_COMPETENCY_DESCRIPTION) || null,
      mapped_dimension: fields.mappedDimension,
      ...(fields.category ? { category: fields.category } : {}),
      ...(fields.levelIndicators ? { level_indicators: cleanLevelIndicators(fields.levelIndicators) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "Could not update competency — try again" };

  revalidatePath("/dashboard/company");
  return { success: true };
}

export async function suggestDimensionForCompetency(
  name: string,
  description?: string
): Promise<{ error: string } | { success: true; dimension: CompetencyDimension | null; rationale: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!name.trim()) return { error: "Enter a competency name first" };

  const membership = await getMyOrganizationMembership();
  // Only the competency builder (an admin screen) calls this; without the
  // check any signed-in account could spend AI budget through it.
  if (membership?.role !== "admin") return { error: "Not authorized" };
  const organizationId = membership?.organization_id ?? null;
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("competency_management")) {
    return { error: "Competency Management has been restricted for your account by your company administrator." };
  }
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  try {
    const { dimension, rationale, model, inputTokens, outputTokens } = await suggestCompetencyDimension(name.trim().slice(0, MAX_COMPETENCY_NAME), description?.trim().slice(0, MAX_COMPETENCY_DESCRIPTION), await resolveCallerLocale(supabase, user.id));
    await recordAiUsage(supabase, { organizationId, userId: user.id, feature: "competency_dimension", model, inputTokens, outputTokens });
    return { success: true, dimension, rationale };
  } catch {
    return { error: "Could not get a suggestion right now — try again." };
  }
}

export type OrganizationCompetencyOption = { id: string; name: string; mappedDimension: string | null };

// Fetches specific competencies by id — used by a competency_ratings
// workflow step to render rows for whichever org-defined competencies it's
// configured with (workflowTypes.ts CompetencyRatingsStepConfig), without
// pulling the whole org framework.
export async function getOrganizationCompetenciesByIds(ids: string[]): Promise<OrganizationCompetencyOption[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_competencies")
    .select("id, name, mapped_dimension")
    .in("id", ids)
    .returns<{ id: string; name: string; mapped_dimension: string | null }[]>();
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, mappedDimension: c.mapped_dimension }));
}

export async function listOrganizationCompetencies(organizationId: string): Promise<OrganizationCompetencyOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_competencies")
    .select("id, name, mapped_dimension")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
    .returns<{ id: string; name: string; mapped_dimension: string | null }[]>();
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, mappedDimension: c.mapped_dimension }));
}

export async function deleteOrganizationCompetency(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("organization_competencies").delete().eq("id", id);
  if (error) {
    // 23503: a role requirement still points at it (0203). Retire it instead.
    if (error.code === "23503") {
      return { error: "This competency is used by one or more roles. Retire it instead of deleting it, or remove it from those roles first." };
    }
    return { error: "Could not delete competency — try again" };
  }

  revalidatePath("/dashboard/company");
  return { success: true };
}

// Retire a competency (or bring it back). A retired competency stays on the
// roles that already use it, so their history is kept, but it is not offered
// for new roles.
export async function setOrganizationCompetencyActive(id: string, active: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("organization_competencies")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not update the competency — try again" };

  revalidatePath("/dashboard/company");
  revalidatePath("/dashboard/company/job-architecture");
  return { success: true };
}
