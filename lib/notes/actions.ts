"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { NoteInsight } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_NOTE_LENGTH = 20000;
const MAX_TITLE_LENGTH = 200;

export async function createNote(title: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmedTitle = title.trim().slice(0, MAX_TITLE_LENGTH);
  const trimmedContent = content.trim();
  if (!trimmedTitle && !trimmedContent) return { error: "Write something first" };
  if (trimmedContent.length > MAX_NOTE_LENGTH) {
    return { error: `Note is too long (max ${MAX_NOTE_LENGTH} characters)` };
  }

  const { data, error } = await supabase
    .from("personal_notes")
    .insert({ user_id: user.id, title: trimmedTitle, content: trimmedContent })
    .select()
    .single();
  if (error || !data) {
    console.error("createNote failed:", error);
    return { error: "Could not save the note — try again." };
  }
  revalidatePath("/dashboard/notes");
  return { id: data.id as string };
}

export async function updateNote(id: string, title: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmedContent = content.trim();
  if (trimmedContent.length > MAX_NOTE_LENGTH) {
    return { error: `Note is too long (max ${MAX_NOTE_LENGTH} characters)` };
  }

  // Editing invalidates the previous AI pass — the summary described text
  // that no longer exists.
  const { error } = await supabase
    .from("personal_notes")
    .update({
      title: title.trim().slice(0, MAX_TITLE_LENGTH),
      content: trimmedContent,
      ai_insight: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not update the note — try again." };
  revalidatePath("/dashboard/notes");
  return { success: true };
}

export async function deleteNote(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("personal_notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete the note — try again." };
  revalidatePath("/dashboard/notes");
  return { success: true };
}

const INSIGHT_TOOL = {
  name: "record_note_insight",
  description: "Organize a personal work note into a short summary and concrete action items.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description:
          "2-4 sentences capturing what this note is actually about, in the note-writer's own framing — organize their thinking, don't editorialize or add advice they didn't ask for.",
      },
      actionItems: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
        description:
          "Concrete follow-ups genuinely implied by the note, each phrased as a short imperative task ('Email Sarah about the Q3 handover'). Empty array if the note contains no real action items — never invent busywork.",
      },
    },
    required: ["summary", "actionItems"],
  },
};

// One AI pass per note version — persisted to ai_insight so reopening the
// note is free. Editing the note clears it (see updateNote).
export async function analyzeNote(id: string): Promise<{ insight?: NoteInsight; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: note } = await supabase
    .from("personal_notes")
    .select("title, content, ai_insight")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<{ title: string; content: string; ai_insight: NoteInsight | null }>();
  if (!note) return { error: "Note not found" };
  if (note.ai_insight) return { insight: note.ai_insight };
  if (!note.content.trim()) return { error: "This note is empty — write something to organize first." };

  let insight: NoteInsight;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system:
        "You organize a professional's private working notes inside their career-development workspace. Work only with what they actually wrote — never invent facts, names, or commitments that aren't in the note.",
      tools: [INSIGHT_TOOL],
      tool_choice: { type: "tool", name: "record_note_insight" },
      messages: [
        {
          role: "user",
          content: `NOTE TITLE: ${note.title || "(untitled)"}\n\nNOTE CONTENT:\n${note.content}`,
        },
      ],
    });
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No structured output");
    const raw = toolUse.input as NoteInsight;
    insight = {
      summary: raw.summary ?? "",
      actionItems: Array.isArray(raw.actionItems) ? raw.actionItems.filter((a) => typeof a === "string") : [],
    };
  } catch (err) {
    console.error("analyzeNote failed:", err);
    return { error: "The AI couldn't process this note right now — try again in a moment." };
  }

  await supabase
    .from("personal_notes")
    .update({ ai_insight: insight })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/dashboard/notes");
  return { insight };
}
