"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { suggestCompetencyDimension } from "./suggestDimension";

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

  try {
    const suggestion = await suggestCompetencyDimension(name, description);
    return { success: true, ...suggestion };
  } catch {
    return { error: "Could not get a suggestion right now — try again." };
  }
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
