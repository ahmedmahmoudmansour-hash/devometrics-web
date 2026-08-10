"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import type { OnboardingTemplate, OnboardingTemplateStep, OnboardingInstanceStep, OnboardingStepType } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;

// Lazily creates the org's one default template on first visit to the
// editor, seeded with the same two steps runHireToOnboarding hardcoded
// before this migration — so an org that never touches this page keeps
// getting the exact onboarding behavior it already had, while anything
// that DOES visit the editor can freely add/reorder/remove from there.
//
// Returns an explicit error instead of throwing — this degrades the same
// way every other newer-table query in this codebase does when its
// migration hasn't run yet (see e.g. getMyOnboarding below), rather than
// crashing the whole admin page with an unhandled exception.
export async function getOrCreateDefaultOnboardingTemplate(
  organizationId: string
): Promise<{ error: string } | { template: OnboardingTemplate; steps: OnboardingTemplateStep[] }> {
  const supabase = await createClient();

  // Ordered + limit(1) rather than .maybeSingle() — resilient to more than
  // one is_default=true row for this org (migration 0117's unique index
  // prevents new duplicates, but this stays defensive rather than crashing
  // with PGRST116 if one ever slips through, e.g. on a database that
  // hasn't run 0117 yet).
  const { data: existingRows, error: readError } = await supabase
    .from("onboarding_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .returns<OnboardingTemplate[]>();
  if (readError) {
    console.error("getOrCreateDefaultOnboardingTemplate read failed:", readError);
    return { error: "not_migrated" };
  }

  let template = existingRows?.[0] ?? null;
  if (!template) {
    const { data: created, error: createError } = await supabase
      .from("onboarding_templates")
      .insert({ organization_id: organizationId, name: "Default onboarding", is_default: true })
      .select()
      .single<OnboardingTemplate>();
    if (createError || !created) {
      // 23505 = unique violation on migration 0117's one-default-per-org
      // index — another request already created it between our read and
      // this insert; re-read instead of surfacing a false "not migrated".
      if (createError?.code === "23505") {
        const { data: raceWinner } = await supabase
          .from("onboarding_templates")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("is_default", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .returns<OnboardingTemplate[]>();
        if (raceWinner?.[0]) {
          template = raceWinner[0];
        } else {
          console.error("getOrCreateDefaultOnboardingTemplate create failed:", createError);
          return { error: "not_migrated" };
        }
      } else {
        console.error("getOrCreateDefaultOnboardingTemplate create failed:", createError);
        return { error: "not_migrated" };
      }
    } else {
      template = created;
      await supabase.from("onboarding_template_steps").insert([
        { template_id: template.id, position: 0, step_type: "task", title: "Complete your profile", due_offset_days: 0 },
        { template_id: template.id, position: 1, step_type: "task", title: "Take your first assessment in the Assessment Center", due_offset_days: 2 },
      ]);
    }
  }

  const { data: steps } = await supabase
    .from("onboarding_template_steps")
    .select("*")
    .eq("template_id", template.id)
    .order("position", { ascending: true })
    .returns<OnboardingTemplateStep[]>();

  return { template, steps: steps ?? [] };
}

export async function addOnboardingTemplateStep(
  templateId: string,
  input: { stepType: OnboardingStepType; title: string; description?: string; knowledgeHubContentId?: string | null; dueOffsetDays: number }
) {
  const supabase = await createClient();
  const title = input.title.trim().slice(0, MAX_TITLE);
  if (!title) return { error: "Give this step a title" };

  const { count } = await supabase
    .from("onboarding_template_steps")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  const { error } = await supabase.from("onboarding_template_steps").insert({
    template_id: templateId,
    position: count ?? 0,
    step_type: input.stepType,
    title,
    description: input.description?.trim().slice(0, MAX_DESCRIPTION) || null,
    knowledge_hub_content_id: input.stepType === "knowledge_hub" ? input.knowledgeHubContentId || null : null,
    due_offset_days: Math.max(0, Math.min(180, Math.round(input.dueOffsetDays))),
  });
  if (error) return { error: "Could not add this step — the database may need migration 0102 run first." };

  revalidatePath("/dashboard/company/onboarding");
  return { success: true };
}

// Editing title/description/due date/document link on an already-added
// step — addOnboardingTemplateStep only ever inserts, and there was no way
// to change a step after the fact short of deleting and re-adding it.
export async function updateOnboardingTemplateStep(
  stepId: string,
  input: { title: string; description?: string; knowledgeHubContentId?: string | null; dueOffsetDays: number }
) {
  const supabase = await createClient();
  const title = input.title.trim().slice(0, MAX_TITLE);
  if (!title) return { error: "Give this step a title" };

  const { error } = await supabase
    .from("onboarding_template_steps")
    .update({
      title,
      description: input.description?.trim().slice(0, MAX_DESCRIPTION) || null,
      knowledge_hub_content_id: input.knowledgeHubContentId || null,
      due_offset_days: Math.max(0, Math.min(180, Math.round(input.dueOffsetDays))),
    })
    .eq("id", stepId);
  if (error) return { error: "Could not update this step — try again." };

  revalidatePath("/dashboard/company/onboarding");
  return { success: true };
}

export async function deleteOnboardingTemplateStep(stepId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("onboarding_template_steps").delete().eq("id", stepId);
  if (error) return { error: "Could not remove this step — try again." };
  revalidatePath("/dashboard/company/onboarding");
  return { success: true };
}

// Simple up/down reorder rather than full drag-and-drop — matches the
// memo's own "simplicity over complexity" principle; the memo's
// drag-and-drop ask is specifically for the Org Chart, not this.
export async function moveOnboardingTemplateStep(templateId: string, stepId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: steps } = await supabase
    .from("onboarding_template_steps")
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
    supabase.from("onboarding_template_steps").update({ position: b.position }).eq("id", a.id),
    supabase.from("onboarding_template_steps").update({ position: a.position }).eq("id", b.id),
  ]);

  revalidatePath("/dashboard/company/onboarding");
  return { success: true };
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Fires from runHireToOnboarding — the acting session IS the new employee
// (self-scoped insert, RLS-safe, no service-role key needed). Snapshots
// each step's content at instantiation time rather than referencing the
// template live, so a later template edit never silently changes what
// this specific person was already assigned mid-onboarding.
export async function instantiateOnboarding(
  supabase: SupabaseServerClient,
  params: { organizationId: string; employeeUserId: string }
): Promise<void> {
  const { data: template } = await supabase
    .from("onboarding_templates")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("is_default", true)
    .maybeSingle<{ id: string }>();
  if (!template) return; // org has never configured onboarding — nothing to instantiate

  const { data: templateSteps } = await supabase
    .from("onboarding_template_steps")
    .select("*")
    .eq("template_id", template.id)
    .order("position", { ascending: true })
    .returns<OnboardingTemplateStep[]>();
  if (!templateSteps || templateSteps.length === 0) return;

  const { data: instance } = await supabase
    .from("onboarding_instances")
    .insert({ organization_id: params.organizationId, employee_user_id: params.employeeUserId, template_id: template.id })
    .select()
    .single<{ id: string }>();
  if (!instance) return;

  await supabase.from("onboarding_instance_steps").insert(
    templateSteps.map((s) => ({
      instance_id: instance.id,
      template_step_id: s.id,
      position: s.position,
      step_type: s.step_type,
      title: s.title,
      description: s.description,
      knowledge_hub_content_id: s.knowledge_hub_content_id,
      due_date: addDaysIso(s.due_offset_days),
    }))
  );
}

export async function getMyOnboarding(): Promise<{ steps: OnboardingInstanceStep[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { steps: [] };

  const { data: instance } = await supabase
    .from("onboarding_instances")
    .select("id")
    .eq("employee_user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!instance) return { steps: [] };

  const { data: steps } = await supabase
    .from("onboarding_instance_steps")
    .select("*")
    .eq("instance_id", instance.id)
    .order("position", { ascending: true })
    .returns<OnboardingInstanceStep[]>();
  if (!steps) return { steps: [] };

  // A 'knowledge_hub' step's real source of truth is the Knowledge Hub's
  // OWN completion table, not a redundant separate click here — someone
  // who already read/confirmed the linked document via the regular
  // Knowledge Hub flow shouldn't have to complete it again just for
  // onboarding to notice. Self-heals completed_at on read so this check
  // only ever needs to run once per step.
  const uncompletedKb = steps.filter((s) => s.step_type === "knowledge_hub" && !s.completed_at && s.knowledge_hub_content_id);
  if (uncompletedKb.length > 0) {
    const contentIds = uncompletedKb.map((s) => s.knowledge_hub_content_id as string);
    const { data: completions } = await supabase
      .from("knowledge_hub_completions")
      .select("content_id")
      .eq("employee_user_id", user.id)
      .in("content_id", contentIds)
      .returns<{ content_id: string }[]>();
    const completedContentIds = new Set((completions ?? []).map((c) => c.content_id));
    const nowIso = new Date().toISOString();
    for (const step of uncompletedKb) {
      if (!completedContentIds.has(step.knowledge_hub_content_id as string)) continue;
      step.completed_at = nowIso;
      step.completed_by = user.id;
      await supabase.from("onboarding_instance_steps").update({ completed_at: nowIso, completed_by: user.id }).eq("id", step.id);
    }
  }

  return { steps };
}

// 'task' steps only — 'knowledge_hub' steps complete themselves via the
// real Knowledge Hub read-confirmation flow (see getMyOnboarding's
// self-heal above), and 'manager_approval' steps are blocked from here by
// RLS regardless, but checking step_type explicitly gives a clear error
// instead of a silent no-op update.
export async function completeMyOnboardingStep(stepId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("onboarding")) {
    return { error: "Onboarding has been restricted for your account by your company administrator." };
  }

  const { error } = await supabase
    .from("onboarding_instance_steps")
    .update({ completed_at: new Date().toISOString(), completed_by: user.id })
    .eq("id", stepId)
    .eq("step_type", "task");
  if (error) return { error: "Could not mark this complete — try again." };

  revalidatePath("/dashboard/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
  return { success: true };
}

// Manager-side: approve a 'manager_approval' step for one of their own
// direct reports — RLS (migration 0102) already restricts this to steps
// belonging to an instance whose employee actually reports to this
// manager, so this action needs no extra authorization check of its own.
export async function approveOnboardingStep(stepId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("onboarding")) {
    return { error: "Onboarding has been restricted for your account by your company administrator." };
  }

  const { error } = await supabase
    .from("onboarding_instance_steps")
    .update({ completed_at: new Date().toISOString(), completed_by: user.id })
    .eq("id", stepId)
    .eq("step_type", "manager_approval");
  if (error) return { error: "Could not approve this step — try again." };

  revalidatePath("/dashboard/my-team");
  return { success: true };
}

export type ReportOnboardingSummary = {
  employeeUserId: string;
  name: string;
  totalSteps: number;
  completedSteps: number;
  pendingApprovalSteps: { id: string; title: string }[];
};

// Feeds My Team's onboarding section — every direct report's checklist
// progress plus any manager_approval steps specifically awaiting this
// manager's action.
export async function listMyReportsOnboarding(): Promise<ReportOnboardingSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: reports } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("manager_user_id", user.id)
    .returns<{ user_id: string }[]>();
  if (!reports || reports.length === 0) return [];

  const reportIds = reports.map((r) => r.user_id);
  const [{ data: instances }, { data: profiles }] = await Promise.all([
    supabase.from("onboarding_instances").select("id, employee_user_id").in("employee_user_id", reportIds).returns<{ id: string; employee_user_id: string }[]>(),
    supabase.from("profiles").select("id, full_name, email").in("id", reportIds).returns<{ id: string; full_name: string | null; email: string }[]>(),
  ]);
  if (!instances || instances.length === 0) return [];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const instanceIds = instances.map((i) => i.id);
  const { data: steps } = await supabase
    .from("onboarding_instance_steps")
    .select("id, instance_id, title, step_type, completed_at")
    .in("instance_id", instanceIds)
    .returns<{ id: string; instance_id: string; title: string; step_type: OnboardingStepType; completed_at: string | null }[]>();

  return instances.map((instance) => {
    const instanceSteps = (steps ?? []).filter((s) => s.instance_id === instance.id);
    const profile = profileById.get(instance.employee_user_id);
    return {
      employeeUserId: instance.employee_user_id,
      name: profile?.full_name || profile?.email || instance.employee_user_id,
      totalSteps: instanceSteps.length,
      completedSteps: instanceSteps.filter((s) => s.completed_at).length,
      pendingApprovalSteps: instanceSteps.filter((s) => s.step_type === "manager_approval" && !s.completed_at).map((s) => ({ id: s.id, title: s.title })),
    };
  });
}

// Thin auth wrapper for the admin template editor page — mirrors the
// isOrgAdmin gate every other /dashboard/company/* page already uses.
export async function requireOrgAdminForOnboarding(): Promise<{ error: string } | { organizationId: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  return { organizationId: data.organizationId };
}
