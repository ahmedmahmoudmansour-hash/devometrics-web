"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseICS } from "./icsImport";

const MAX_FILE_LENGTH = 2_000_000; // generous cap for a calendar export as plain text
const MAX_EVENTS_IMPORTED = 300;

export async function importCalendarICS(icsText: string): Promise<{ imported?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (typeof icsText !== "string" || !icsText.includes("BEGIN:VCALENDAR")) {
    return { error: "That doesn't look like a calendar (.ics) file." };
  }
  if (icsText.length > MAX_FILE_LENGTH) {
    return { error: "That calendar file is too large to import." };
  }

  const events = parseICS(icsText, MAX_EVENTS_IMPORTED);
  if (events.length === 0) {
    return { error: "No events with a date were found in that file." };
  }

  const { error } = await supabase.from("personal_tasks").insert(
    events.map((e) => ({
      user_id: user.id,
      title: e.title || "Untitled event",
      subtasks: [],
      recurring: "none",
      priority: "medium",
      icon: "📅",
      date: e.date,
      time: e.time,
    }))
  );
  if (error) {
    console.error("importCalendarICS insert failed:", error);
    return { error: "Could not import that calendar — try again." };
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
  return { imported: events.length };
}
