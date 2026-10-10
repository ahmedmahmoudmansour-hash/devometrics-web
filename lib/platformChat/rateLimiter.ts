import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";

// First layer: in-memory, per-process, free. There's no user_id to key a
// DB-backed limit against here like every other AI route uses, so this keys
// on IP. It resets on restart and isn't shared across server instances, which
// is why it is only the first layer — see isRateLimitedShared below.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 8;

const hits = new Map<string, number[]>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Drop addresses with no recent requests so the map can't grow without bound.
  for (const [key, times] of hits) {
    if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}

// Second layer: database-backed (migration 0196, platform_chat_allow). Holds
// across instances and restarts, and enforces a ceiling on the chatbot's total
// use per hour, which bounds what an unauthenticated route can spend on the AI
// API. The IP is hashed before it leaves the app. If the database can't be
// reached the request is allowed — the in-memory layer has already applied —
// so a database problem never takes the chatbot down.
export async function isRateLimitedShared(ip: string): Promise<boolean> {
  try {
    const key = createHash("sha256").update(`platform-chat:${ip}`).digest("hex");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("platform_chat_allow", { p_key: key });
    if (error) {
      console.error("platform_chat_allow failed:", error.message);
      return false;
    }
    return data === false;
  } catch (err) {
    console.error("platform chat shared limiter error:", err);
    return false;
  }
}
