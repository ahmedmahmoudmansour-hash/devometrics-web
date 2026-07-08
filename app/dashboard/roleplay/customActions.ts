"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type { Profile } from "@/lib/supabase/types";

const MAX_FIELD_LENGTH = 2000;

export async function createCustomScenario(fields: {
  title: string;
  setup: string;
  yourRole: string;
  openingMessage: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, premium_trial_expires_at, is_admin")
    .eq("id", user.id)
    .single<Profile>();
  if (effectiveSubscriptionTier(profile ?? null) === "free") {
    return { error: "Custom scenarios are a Premium feature — upgrade to create one." };
  }

  const title = fields.title.trim();
  const setup = fields.setup.trim();
  const yourRole = fields.yourRole.trim();
  const openingMessage = fields.openingMessage.trim();

  if (!title || !setup || !yourRole || !openingMessage) {
    return { error: "Every field is required — the AI needs the full picture to play its part." };
  }
  if ([title, setup, yourRole, openingMessage].some((v) => v.length > MAX_FIELD_LENGTH)) {
    return { error: `Each field must be under ${MAX_FIELD_LENGTH} characters.` };
  }

  const { data, error } = await supabase
    .from("custom_scenarios")
    .insert({
      user_id: user.id,
      title,
      setup,
      your_role: yourRole,
      opening_message: openingMessage,
    })
    .select()
    .single();
  if (error || !data) return { error: "Could not create your scenario — try again." };

  revalidatePath("/dashboard/roleplay");
  return { scenarioId: data.id as string };
}

export async function deleteCustomScenario(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("custom_scenarios").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Could not delete this scenario." };

  revalidatePath("/dashboard/roleplay");
  return { success: true };
}
