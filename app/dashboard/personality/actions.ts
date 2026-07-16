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

// Opt-in, defaults off (migration 0065) — personality data gets an explicit
// consent gate an employee controls, unlike competency/assessment data
// which is admin-visible automatically once someone joins an org. Enforced
// at the RLS layer too, not just this toggle: flipping this off actually
// revokes access, it isn't cosmetic.
export async function updateBigFiveSharing(share: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("profiles").update({ share_big_five_with_admin: share }).eq("id", user.id);
  if (error) return { error: "Could not save — try again." };

  revalidatePath("/dashboard/profile");
  return { success: true };
}
