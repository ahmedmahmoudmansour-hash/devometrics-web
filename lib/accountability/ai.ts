"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizationMembership } from "@/lib/organizations/actions";
import { assertAiBudgetOk, recordAiUsage } from "@/lib/aiUsage/track";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type MemberProfile = { user_id: string; full_name: string | null; avatar_url: string | null };
type CheckinRow = { content: string; created_at: string; user_id: string };

// Free-text answer, not a structured extraction — same shape as Coach
// itself, not sessionSummary's forced tool_use. Haiku 4.5, same routing
// reasoning as Coach: a conversational, budget-capped feature, not a
// scored decision.
export async function askAccountabilityGroupAI(groupId: string, question: string): Promise<{ answer?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) return { error: "Ask something first" };

  // Explicit membership check before spending an AI call — RLS on the
  // check-ins query below already means a non-member gets zero rows, but
  // that would read as "no check-ins yet" rather than "you're not in this
  // group", which is a worse and more confusing error.
  const { data: membershipRow } = await supabase
    .from("accountability_group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle<{ group_id: string }>();
  if (!membershipRow) return { error: "You're not a member of this group" };

  const membership = await getMyOrganizationMembership();
  const organizationId = membership?.organization_id ?? null;
  const budgetCheck = await assertAiBudgetOk(supabase, { organizationId, userId: user.id });
  if (budgetCheck.error) return { error: budgetCheck.error };

  const { data: group } = await supabase
    .from("accountability_groups")
    .select("name, description")
    .eq("id", groupId)
    .maybeSingle<{ name: string; description: string | null }>();

  const { data: checkinRows } = await supabase
    .from("accountability_checkins")
    .select("content, created_at, user_id")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CheckinRow[]>();

  const { data: profileRows } = await supabase.rpc("get_accountability_group_member_profiles", { target_group_id: groupId });
  const nameById = new Map((profileRows as MemberProfile[] | null ?? []).map((p) => [p.user_id, p.full_name ?? "Member"]));

  const context = (checkinRows ?? [])
    .slice()
    .reverse()
    .map((c) => `${nameById.get(c.user_id) ?? "Member"} (${new Date(c.created_at).toLocaleDateString()}): ${c.content}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: `You are a supportive research and study assistant for a peer accountability group called "${group?.name ?? "this group"}"${group?.description ? ` (focus: ${group.description})` : ""} on Devometrics. Members post short check-ins about what they're working on. Answer the member's question, grounding your answer in the group's recent check-in history where it's actually relevant, and using your own general knowledge otherwise -- don't force a connection to the check-ins if there isn't one. Be concise, practical, and encouraging; this is a peer accountability space, not a formal report.`,
      messages: [
        {
          role: "user",
          content: context
            ? `RECENT GROUP CHECK-INS:\n${context}\n\nQUESTION: ${trimmedQuestion}`
            : `(No check-ins posted in this group yet.)\n\nQUESTION: ${trimmedQuestion}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const answer = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    if (!answer) throw new Error("No text in response");

    await recordAiUsage(supabase, {
      organizationId,
      userId: user.id,
      feature: "accountability_group_ai",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return { answer };
  } catch (err) {
    console.error("askAccountabilityGroupAI failed:", err);
    return { error: "Couldn't reach the AI assistant right now — try again in a moment." };
  }
}
