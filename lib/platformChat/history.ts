import { MAX_PLATFORM_CHAT_HISTORY, MAX_PLATFORM_CHAT_HISTORY_ENTRY_LENGTH } from "@/lib/limits";

export type ChatTurn = { role: "user" | "assistant"; content: string };

// The history comes from an unauthenticated client: keep only well-formed
// turns and bound each one, so a single request can't carry an arbitrarily
// large prompt to the paid API.
export function sanitizeHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return [];
  const turns: ChatTurn[] = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.slice(0, MAX_PLATFORM_CHAT_HISTORY_ENTRY_LENGTH);
    if (text.trim()) turns.push({ role, content: text });
  }
  return turns.slice(-MAX_PLATFORM_CHAT_HISTORY);
}
