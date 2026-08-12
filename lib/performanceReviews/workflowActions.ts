"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { STARTER_TEMPLATES, type StarterKey } from "./starterTemplates";
import type { WorkflowTemplate, WorkflowStep, StepType, StepData } from "./workflowTypes";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const REVALIDATE_PATH = "/dashboard/company/impact-cycles";

// Thin auth wrapper for the admin workflow editor.
export async function requireOrgAdminForWorkflows(): Promise<{ error: string } | { organizationId: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  return { organizationId: data.organizationId };
}

// Lazily creates the org's one default template on first visit, seeded with
// today's actual 5-step sequence — matches the migration 0103 backfill
// exactly, so an org that never touches the editor keeps the exact behavior
// it already had. Returns an explicit error instead of throwing rather than
// letting a missing-schema query bubble up as a crash.
export async function getOrCreateDefaultWorkflowTemplate(
  organizationId: string
): Promise<{ error: string } | { template: WorkflowTemplate; steps: WorkflowStep[] }> {
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("performance_review_workflow_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .maybeSingle<WorkflowTemplate>();
  if (readError) return { error: "not_migrated" };

  let template = existing;
  if (!template) {
    const starter = STARTER_TEMPLATES.devometrics_best_practice;
    const { data: created, error: createError } = await supabase
      .from("performance_review_workflow_templates")
      .insert({ organization_id: organizationId, name: "Standard Impact Cycle", is_default: true })
      .select()
      .single<WorkflowTemplate>();
    if (createError || !created) return { error: "not_migrated" };
    template = created;
    await supabase.from("performance_review_workflow_steps").insert(
      starter.steps.map((s, i) => ({
        template_id: template!.id,
        position: i,
        step_type: s.stepType,
        title: s.title,
        description: s.description ?? null,
        data: s.data ?? {},
      }))
    );
  }

  const { data: steps } = await supabase
    .from("performance_review_workflow_steps")
    .select("*")
    .eq("template_id", template.id)
    .order("position", { ascending: true })
    .returns<WorkflowStep[]>();

  return { template, steps: steps ?? [] };
}

export async function listWorkflowTemplates(organizationId: string): Promise<WorkflowTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_review_workflow_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .returns<WorkflowTemplate[]>();
  return data ?? [];
}

export async function getWorkflowTemplateSteps(templateId: string): Promise<WorkflowStep[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_review_workflow_steps")
    .select("*")
    .eq("template_id", templateId)
    .order("position", { ascending: true })
    .returns<WorkflowStep[]>();
  return data ?? [];
}

export async function addWorkflowStep(
  templateId: string,
  input: { stepType: StepType; title: string; description?: string; data?: StepData }
) {
  const supabase = await createClient();
  const title = input.title.trim().slice(0, MAX_TITLE);
  if (!title) return { error: "Give this step a title" };

  const { count } = await supabase
    .from("performance_review_workflow_steps")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  const { error } = await supabase.from("performance_review_workflow_steps").insert({
    template_id: templateId,
    position: count ?? 0,
    step_type: input.stepType,
    title,
    description: input.description?.trim().slice(0, MAX_DESCRIPTION) || null,
    data: input.data ?? {},
  });
  if (error) return { error: "Could not add this step — the database may need migration 0103 run first." };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function updateWorkflowStep(
  stepId: string,
  input: { title?: string; description?: string | null; data?: StepData }
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim().slice(0, MAX_TITLE);
    if (!title) return { error: "Give this step a title" };
    update.title = title;
  }
  if (input.description !== undefined) update.description = input.description?.trim().slice(0, MAX_DESCRIPTION) || null;
  if (input.data !== undefined) update.data = input.data;

  const { error } = await supabase.from("performance_review_workflow_steps").update(update).eq("id", stepId);
  if (error) return { error: "Could not update this step — try again." };

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

export async function deleteWorkflowStep(stepId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("performance_review_workflow_steps").delete().eq("id", stepId);
  if (error) return { error: "Could not remove this step — try again." };
  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// Simple up/down reorder rather than drag-and-drop — true drag-and-drop is
// reserved for the Org Chart (Workstream 6), matching the memo's own
// "simplicity over complexity" principle.
export async function moveWorkflowStep(templateId: string, stepId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: steps } = await supabase
    .from("performance_review_workflow_steps")
    .select("id, position")
    .eq("template_id", templateId)
    .order("position", { ascending: true })
    .returns<{ id: string; position: number }[]>();
  if (!steps) return { error: "Could not load steps — try again." };

  const index = steps.findIndex((s) => s.id === stepId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= steps.length) return { success: true }; // already at an edge, no-op

  const a = steps[index];
  const b = steps[swapWith];
  await Promise.all([
    supabase.from("performance_review_workflow_steps").update({ position: b.position }).eq("id", a.id),
    supabase.from("performance_review_workflow_steps").update({ position: a.position }).eq("id", b.id),
  ]);

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// Feeds CustomStepAssigneePicker's manual-mode org-member search — a
// manager or admin picking specific peers, an executive, or a country lead
// for a custom step.
export async function listOrganizationMembersForAssignment(organizationId: string): Promise<{ userId: string; name: string; email: string }[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .returns<{ user_id: string }[]>();
  if (!members || members.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", members.map((m) => m.user_id))
    .returns<{ id: string; full_name: string | null; email: string }[]>();

  return (profiles ?? [])
    .map((p) => ({ userId: p.id, name: p.full_name || p.email, email: p.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setCycleWorkflowTemplate(cycleId: string, templateId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_review_cycles")
    .update({ workflow_template_id: templateId })
    .eq("id", cycleId);
  if (error) return { error: "Could not set the template — try again." };
  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

// Materializes one of the static starter catalogs (starterTemplates.ts)
// into a real, then-fully-editable org template — never a live reference to
// the static catalog, same snapshot discipline as everything else here.
export async function cloneStarterTemplate(
  organizationId: string,
  starterKey: StarterKey,
  name: string
): Promise<{ error: string } | { success: true; template: WorkflowTemplate }> {
  const supabase = await createClient();
  const starter = STARTER_TEMPLATES[starterKey];
  if (!starter) return { error: "Unknown starter template" };

  const trimmedName = name.trim().slice(0, MAX_TITLE) || starter.key;

  const { count } = await supabase
    .from("performance_review_workflow_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  const { data: created, error } = await supabase
    .from("performance_review_workflow_templates")
    .insert({ organization_id: organizationId, name: trimmedName, is_default: (count ?? 0) === 0 })
    .select()
    .single<WorkflowTemplate>();
  if (error || !created) return { error: "Could not create template — try again." };

  if (starter.steps.length > 0) {
    const { error: stepsError } = await supabase.from("performance_review_workflow_steps").insert(
      starter.steps.map((s, i) => ({
        template_id: created.id,
        position: i,
        step_type: s.stepType,
        title: s.title,
        description: s.description ?? null,
        data: s.data ?? {},
      }))
    );
    if (stepsError) return { error: "Template created, but its steps could not be added — try editing it manually." };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true, template: created };
}
