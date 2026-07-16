"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { COMPETENCY_DIMENSIONS } from "@/lib/gap-analysis/dimensions";
import type { RoleTrack } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_NAME = 120;
const MAX_TEXT = 4000;

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

export async function createJobFamily(name: string, description: string) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) return { error: "Give the family a name" };

  const { error } = await supabase.from("job_families").insert({
    organization_id: organizationId,
    name: trimmed,
    description: description.trim().slice(0, MAX_TEXT),
    created_by: user.id,
  });
  if (error) {
    console.error("createJobFamily failed:", error);
    return { error: "Could not create the family — the database may need migration 0067 run first." };
  }
  revalidatePath("/dashboard/company/job-architecture");
  return { success: true };
}

export async function deleteJobFamily(familyId: string) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };
  // RLS restricts this to admins of the family's own org — cascade removes
  // the family's roles, their requirements, and any transitions touching them.
  await supabase.from("job_families").delete().eq("id", familyId);
  revalidatePath("/dashboard/company/job-architecture");
  return { success: true };
}

type RoleInput = {
  jobFamilyId: string;
  title: string;
  level: string;
  grade: number;
  track: RoleTrack;
  responsibilities: string;
  requirements: { dimension: string; targetLevel: number }[];
};

export async function createJobRole(input: RoleInput) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };

  const title = input.title.trim().slice(0, MAX_NAME);
  if (!title) return { error: "Give the role a title" };
  const grade = Math.min(10, Math.max(1, Math.round(input.grade)));
  const track: RoleTrack = input.track === "management" ? "management" : "ic";

  const { data: role, error } = await supabase
    .from("job_roles")
    .insert({
      organization_id: organizationId,
      job_family_id: input.jobFamilyId,
      title,
      level: input.level.trim().slice(0, 40),
      grade,
      track,
      responsibilities: input.responsibilities.trim().slice(0, MAX_TEXT),
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !role) {
    console.error("createJobRole failed:", error);
    return { error: "Could not create the role — the database may need migration 0067 run first." };
  }

  // Only store requirements for the 8 real dimensions, clamped 0-100 — the
  // dimension list is a fixed enum, so anything else is dropped rather than
  // trusted (defense in depth on top of the AI tool schema).
  const validDims = new Set<string>(COMPETENCY_DIMENSIONS);
  const rows = input.requirements
    .filter((r) => validDims.has(r.dimension))
    .map((r) => ({
      organization_id: organizationId,
      role_id: role.id,
      dimension: r.dimension,
      target_level: Math.min(100, Math.max(0, Math.round(r.targetLevel))),
    }));
  if (rows.length) await supabase.from("role_competency_requirements").insert(rows);

  revalidatePath("/dashboard/company/job-architecture");
  return { success: true, roleId: role.id };
}

export async function deleteJobRole(roleId: string) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };
  await supabase.from("job_roles").delete().eq("id", roleId);
  revalidatePath("/dashboard/company/job-architecture");
  return { success: true };
}

export async function addRoleTransition(fromRoleId: string, toRoleId: string, transitionType: "vertical" | "horizontal", note: string) {
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return { error: "Not authorized" };
  if (fromRoleId === toRoleId) return { error: "A role can't transition to itself" };

  const { error } = await supabase.from("role_transitions").insert({
    organization_id: organizationId,
    from_role_id: fromRoleId,
    to_role_id: toRoleId,
    transition_type: transitionType,
    note: note.trim().slice(0, 500),
  });
  if (error) {
    if (error.code === "23505") return { error: "That path already exists." };
    return { error: "Could not add the path — try again." };
  }
  revalidatePath("/dashboard/company/job-architecture");
  return { success: true };
}

export async function removeRoleTransition(transitionId: string) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };
  await supabase.from("role_transitions").delete().eq("id", transitionId);
  revalidatePath("/dashboard/company/job-architecture");
  return { success: true };
}

// Places (or unplaces, with null) an employee into a role in the architecture.
export async function setMemberRole(memberId: string, roleId: string | null) {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };
  // RLS on organization_members (0049) already scopes this to admins of the
  // member's own org.
  const { error } = await supabase.from("organization_members").update({ current_role_id: roleId }).eq("id", memberId);
  if (error) {
    console.error("setMemberRole failed:", error);
    return { error: "Could not update — the database may need migration 0067 run first." };
  }
  revalidatePath("/dashboard/company/employees");
  revalidatePath("/dashboard/company/job-architecture");
  return { success: true };
}

const GRADING_TOOL = {
  name: "record_role_grading",
  description: "Grade a role and define its required competency profile from its title and responsibilities.",
  input_schema: {
    type: "object" as const,
    properties: {
      grade: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description:
          "Grade band 1-10, rising with scope, autonomy, impact, and complexity of the role. 1-2 entry, 3-4 developing, 5-6 experienced/senior IC or team lead, 7-8 principal/manager of managers, 9-10 executive.",
      },
      track: { type: "string", enum: ["ic", "management"], description: "Individual-contributor ladder or management ladder." },
      level: { type: "string", description: "Short ladder label consistent with track and grade, e.g. 'IC3', 'M2', 'Senior', 'Principal'." },
      rationale: { type: "string", description: "1-2 sentences justifying the grade from the responsibilities given — no invented facts." },
      competencyRequirements: {
        type: "array",
        description: "Target level (0-100) this role requires on each RELEVANT dimension. Only include dimensions the role genuinely demands; omit ones that don't apply. Use ONLY the exact dimension names provided.",
        items: {
          type: "object",
          properties: {
            dimension: { type: "string", enum: [...COMPETENCY_DIMENSIONS] },
            targetLevel: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["dimension", "targetLevel"],
        },
      },
    },
    required: ["grade", "track", "level", "rationale", "competencyRequirements"],
  },
};

export type RoleGradingSuggestion = {
  grade: number;
  track: RoleTrack;
  level: string;
  rationale: string;
  competencyRequirements: { dimension: string; targetLevel: number }[];
};

// The headline capability: turn a plain role title + responsibilities into a
// suggested grade, track, level, and required-competency profile. Decision
// support the admin reviews and edits before saving — never auto-applied.
// claude-sonnet-5 (not Opus): this is a well-scoped structured extraction,
// exactly what Sonnet handles cleanly and cheaply at per-role volume.
export async function suggestRoleGrading(title: string, responsibilities: string): Promise<{ error: string } | { suggestion: RoleGradingSuggestion }> {
  const { user } = await requireAdmin();
  if (!user) return { error: "Not authorized" };

  const cleanTitle = title.trim().slice(0, MAX_NAME);
  if (!cleanTitle) return { error: "Enter a role title first" };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system:
        "You are a compensation and job-architecture analyst. Grade roles consistently on a 1-10 band that rises with scope, autonomy, impact, and complexity, and define the competency profile a role genuinely requires. Ground every judgment strictly in the title and responsibilities given — never invent duties, headcount, or seniority that isn't stated. This is decision support an HR admin will review and edit, not an automated grading decision. Use ONLY the exact competency dimension names provided in the tool schema.",
      tools: [GRADING_TOOL],
      tool_choice: { type: "tool", name: "record_role_grading" },
      messages: [
        {
          role: "user",
          content: `ROLE TITLE: ${cleanTitle}\n\nRESPONSIBILITIES:\n${responsibilities.trim().slice(0, MAX_TEXT) || "(none provided — infer a sensible profile from the title alone, and keep confidence modest)"}`,
        },
      ],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as RoleGradingSuggestion;
    const validDims = new Set<string>(COMPETENCY_DIMENSIONS);
    return {
      suggestion: {
        grade: Math.min(10, Math.max(1, Math.round(raw.grade))),
        track: raw.track === "management" ? "management" : "ic",
        level: (raw.level ?? "").slice(0, 40),
        rationale: raw.rationale ?? "",
        competencyRequirements: (raw.competencyRequirements ?? [])
          .filter((r) => validDims.has(r.dimension))
          .map((r) => ({ dimension: r.dimension, targetLevel: Math.min(100, Math.max(0, Math.round(r.targetLevel))) })),
      },
    };
  } catch (err) {
    console.error("suggestRoleGrading failed:", err);
    return { error: "Couldn't generate a grading suggestion right now — try again in a moment." };
  }
}
