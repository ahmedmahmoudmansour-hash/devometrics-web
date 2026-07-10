"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

// Returns the user's calendar feed token, minting one on first use. The
// token is the entire credential for the public ICS feed (see migration
// 0050), so it's long, random, and regenerable.
export async function getCalendarFeedToken(): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("calendar_feed_token")
    .eq("id", user.id)
    .single<{ calendar_feed_token: string | null }>();
  if (readError) {
    return { error: "Calendar sync isn't enabled yet — migration 0050 needs to be run first." };
  }
  if (profile?.calendar_feed_token) return { token: profile.calendar_feed_token };

  const token = randomBytes(32).toString("hex");
  const { error } = await supabase
    .from("profiles")
    .update({ calendar_feed_token: token })
    .eq("id", user.id);
  if (error) {
    return { error: "Could not set up calendar sync — try again." };
  }
  return { token };
}
