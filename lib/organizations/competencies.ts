"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { suggestCompetencyDimension } from "./suggestDimension";
import { getMyOrganizationMembership } from "./actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";

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
  fields: { name: string; description?: string; mappedDimension: string | null }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = fields.name.trim();
  if (!name) return { error: "Competency name is required" };
  if (fields.mappedDimension !== null && !isValidDimension(fields.mappedDimension)) {
    return { error: "Invalid dimension" };
  }

  const { error } = await supabase.from("organization_competencies").insert({
    organization_id: organizationId,
    name,
    description: fields.description?.trim() || null,
    mapped_dimension: fields.mappedDimension,
  });
  if (error) return { error: "Could not save competency — try again" };

  revalidatePath("/dashboard/company");
  return { success: true };
}

export async function updateOrganizationCompetency(
  id: string,
  fields: { name: string; description?: string; mappedDimension: string | null }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = fields.name.trim();
  if (!name) return { error: "Competency name is required" };
  if (fields.mappedDimension !== null && !isValidDimension(fields.mappedDimension)) {
    return { error: "Invalid dimension" };
  }

  const { error } = await supabase
    .from("organization_competencies")
    .update({
      name,
      description: fields.description?.trim() || null,
      mapped_dimension: fields.mappedDimension,
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
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  try {
    const { dimension, rationale, model, inputTokens, outputTokens } = await suggestCompetencyDimension(name, description);
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
  if (error) return { error: "Could not delete competency — try again" };

  revalidatePath("/dashboard/company");
  return { success: true };
}
