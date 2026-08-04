"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";

// Kept separate from ai.ts on purpose, so that file's five-function
// core-only list stays visibly unchanged — this function is deliberately
// isolated: it never touches Gap Analysis, cross-review data, or
// organization context, only this one step's own title/description/shape
// plus the responder's own rough notes, so it's structurally incapable of
// leaking core-5 analytics into a custom step.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TEXT = 2000;

export async function draftCustomStepResponse(
  instanceStepId: string,
  roughNotes?: string
): Promise<{ error: string } | { draft: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: step } = await supabase
    .from("performance_review_instance_steps")
    .select("title, description, data")
    .eq("id", instanceStepId)
    .eq("step_type", "custom")
    .maybeSingle<{ title: string; description: string | null; data: { response_shape?: string; ai_assist_enabled?: boolean } }>();
  if (!step) return { error: "Step not found" };

  const responseShape = step.data?.response_shape ?? "text";
  const aiEnabled = step.data?.ai_assist_enabled ?? true;
  if (!aiEnabled) return { error: "AI assist is turned off for this step" };

  const { data: isAssigned } = await supabase
    .from("performance_review_custom_step_assignments")
    .select("id")
    .eq("instance_step_id", instanceStepId)
    .eq("assignee_user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!isAssigned) return { error: "Not authorized" };

  const trimmedNotes = roughNotes?.trim().slice(0, MAX_TEXT) ?? "";

  const membership = await getMyOrganizationMembership();
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  const shapeInstruction =
    responseShape === "approval"
      ? "Write a short supporting comment (1-3 sentences) for an approve/reject decision."
      : responseShape === "rating"
        ? "Write a short comment (1-3 sentences) explaining a 1-5 rating."
        : "Write a short paragraph response (3-6 sentences).";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        `Turn this person's rough notes into a clear written response for a "${step.title}" step in a performance workflow${step.description ? ` (${step.description})` : ""}. ${shapeInstruction} Use only what they actually wrote — never add facts, names, or claims they didn't mention. Keep their voice. Plain text only, no headers or bullet points.`,
      messages: [{ role: "user", content: trimmedNotes || "(No rough notes given — write a brief, generic placeholder they can edit.)" }],
    });
    await recordAiUsage(supabase, {
      organizationId,
      userId: user.id,
      feature: "custom_step_ai",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text output");
    return { draft: text.text.trim() };
  } catch (err) {
    console.error("draftCustomStepResponse failed:", err);
    return { error: "Couldn't draft this right now — try again in a moment." };
  }
}
