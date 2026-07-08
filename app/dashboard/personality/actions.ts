"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BIG_FIVE_ITEMS, scoreBigFive } from "@/lib/personality/bigFive";

export async function saveBigFiveProfile(answers: Record<string, number>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (BIG_FIVE_ITEMS.some((item) => typeof answers[item.id] !== "number")) {
    return { error: "Please answer every statement first." };
  }

  const scores = scoreBigFive(answers);

  const { error } = await supabase.from("big_five_profiles").insert({
    user_id: user.id,
    answers,
    scores,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/personality");
  return { success: true, scores };
}
