"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Lets someone clear the AI Coach's running GROW-model summary if it's ever
// stale or wrong, without needing to delete their whole message history to
// do it — the memory is a derived summary, not the source of truth.
export async function resetGrowMemory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("coach_grow_memory").delete().eq("user_id", user.id);
  if (error) return { error: "Could not reset coaching memory — try again" };

  revalidatePath("/dashboard/coach");
  return { success: true };
}
