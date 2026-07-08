"use server";

import { createClient } from "@/lib/supabase/server";

function daysBetween(laterDate: string, earlierDate: string): number {
  return Math.round((new Date(laterDate).getTime() - new Date(earlierDate).getTime()) / 86_400_000);
}

// Called once per dashboard load. Consecutive calendar day since the last
// visit extends the streak, the same day is a no-op, any gap resets to 1.
// Deliberately calendar-date based (UTC), not a rolling 24h window — simpler
// to reason about and matches how users think about "days in a row."
export async function recordDailyActivity(): Promise<{ currentStreak: number; longestStreak: number } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_active_date, current_streak_days, longest_streak_days")
    .eq("id", user.id)
    .single<{ last_active_date: string | null; current_streak_days: number; longest_streak_days: number }>();

  const today = new Date().toISOString().slice(0, 10);
  const lastActive = profile?.last_active_date ?? null;
  const currentStreak = profile?.current_streak_days ?? 0;
  const longestStreak = profile?.longest_streak_days ?? 0;

  if (lastActive === today) {
    return { currentStreak, longestStreak };
  }

  const gap = lastActive ? daysBetween(today, lastActive) : null;
  const newStreak = gap === 1 ? currentStreak + 1 : 1;
  const newLongest = Math.max(longestStreak, newStreak);

  await supabase
    .from("profiles")
    .update({ last_active_date: today, current_streak_days: newStreak, longest_streak_days: newLongest })
    .eq("id", user.id);

  return { currentStreak: newStreak, longestStreak: newLongest };
}
