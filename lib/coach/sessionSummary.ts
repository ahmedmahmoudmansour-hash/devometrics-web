"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import type { CoachMessage } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type SessionSummary = {
  meetingNotes: string;
  actionPlan: string[];
};

const SUMMARY_TOOL = {
  name: "record_session_summary",
  description: "Summarize a coaching session into meeting notes and a concrete action plan.",
  input_schema: {
    type: "object" as const,
    properties: {
      meetingNotes: {
        type: "string",
        description:
          "3-6 sentences of meeting notes: what was discussed, what the person is working through, and any decisions or realizations they reached. Written to the person ('You discussed…'), grounded only in what was actually said.",
      },
      actionPlan: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6,
        description:
          "Concrete next actions that genuinely came out of this conversation, each a short imperative ('Draft the stakeholder update before Friday'). Only commitments or clear next steps actually discussed — never invent homework.",
      },
    },
    required: ["meetingNotes", "actionPlan"],
  },
};

// Summarizes TODAY's session only — matching the per-day session grouping in
// the coach UI. Nothing is persisted; the summary is ephemeral in-app and
// optionally emailed.
export async function generateSessionSummary(): Promise<{ summary?: SessionSummary; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: messages } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: true })
    .returns<CoachMessage[]>();

  const userTurns = (messages ?? []).filter((m) => m.role === "user").length;
  if (!messages || userTurns < 2) {
    return { error: "Not enough conversation to summarize yet — talk with your coach a bit first." };
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "CLIENT" : "COACH"}: ${m.content}`)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system:
        "You summarize an AI career-coaching session on Devometrics for the client's own records. Summarize only what was actually discussed — no invented commitments, no advice beyond what the coach actually gave.",
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "tool", name: "record_session_summary" },
      messages: [{ role: "user", content: `TODAY'S SESSION TRANSCRIPT:\n\n${transcript}` }],
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as SessionSummary;
    return {
      summary: {
        meetingNotes: raw.meetingNotes ?? "",
        actionPlan: Array.isArray(raw.actionPlan) ? raw.actionPlan.filter((a) => typeof a === "string") : [],
      },
    };
  } catch (err) {
    console.error("generateSessionSummary failed:", err);
    return { error: "Couldn't generate the summary right now — try again in a moment." };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function emailSessionSummary(summary: SessionSummary): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not authenticated" };

  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const html = `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a2236;">
      <h2 style="color: #0A0F1E;">Your coaching session — ${dateLabel}</h2>
      <h3 style="color: #097066; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Meeting notes</h3>
      <p style="line-height: 1.7; font-size: 15px;">${escapeHtml(summary.meetingNotes)}</p>
      <h3 style="color: #097066; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Action plan</h3>
      <ul style="line-height: 1.9; font-size: 15px; padding-left: 20px;">
        ${summary.actionPlan.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}
      </ul>
      <p style="font-size: 12px; color: #8892a4; margin-top: 28px;">
        Sent from your AI Career Coach on Devometrics. AI-generated summary of your own session.
      </p>
    </div>`;

  try {
    await sendEmail(user.email, `Coaching session summary — ${dateLabel}`, html);
    return { success: true };
  } catch (err) {
    // Most likely cause pre-launch: RESEND_API_KEY not configured yet —
    // surface the real reason rather than a generic failure.
    return { error: err instanceof Error ? err.message : "Could not send the email." };
  }
}
