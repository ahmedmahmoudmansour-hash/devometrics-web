// Rules that keep AI cost down without removing a feature. Pure functions, so
// they can be tested without calling a model or the database.

// How many of the latest coach messages are sent with each new message. The
// running GROW summary carries the longer history, so the coach does not need
// the whole thread every time.
export const COACH_HISTORY_MESSAGES = 20;

// The GROW (goal, reality, options, will) memory is refreshed this often, in
// user messages, instead of after every message. Each refresh covers every
// exchange since the last one, so nothing is lost.
export const GROW_MEMORY_EVERY_N_TURNS = 4;

// An unchanged daily insight is reused for at most this long before it is
// regenerated, so it does not go stale.
export const INSIGHT_MAX_REUSE_DAYS = 7;

// Saved course searches are served for this long.
export const COURSE_CACHE_TTL_DAYS = 14;

export type StoredMessage = { role: string; content: string; created_at: string };

const at = (iso: string) => Date.parse(iso);

// The messages to send to the coach: the latest ones, oldest first, starting
// on a user message (the API expects a conversation to open with the user).
export function recentCoachHistory<T extends { role: string }>(newestFirst: T[] | null | undefined): T[] {
  const ordered = [...(newestFirst ?? [])].reverse();
  while (ordered.length > 0 && ordered[0].role !== "user") ordered.shift();
  return ordered;
}

// Decide whether to refresh the GROW memory after this reply, and give the
// updater the exchanges it has not seen yet. `previousMessages` are the
// messages before the current one, oldest first.
export function growMemoryUpdatePlan(
  memoryUpdatedAt: string | null | undefined,
  previousMessages: StoredMessage[]
): { update: boolean; transcript: string } {
  const hasMemory = !!memoryUpdatedAt && !Number.isNaN(at(memoryUpdatedAt));
  const unseen = hasMemory ? previousMessages.filter((m) => at(m.created_at) > at(memoryUpdatedAt as string)) : previousMessages;
  const turnsSinceUpdate = unseen.filter((m) => m.role === "user").length + 1; // +1: the current message
  const update = !hasMemory || turnsSinceUpdate >= GROW_MEMORY_EVERY_N_TURNS;
  const transcript = unseen
    .slice(-12)
    .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content.slice(0, 500)}`)
    .join("\n");
  return { update, transcript };
}

// A new daily insight is only worth paying for when the person's data has
// changed (a newer gap analysis) or the last one is old. Otherwise yesterday's
// sentence is reused: same data, same insight.
export function canReuseInsight(args: {
  latestAnalysisCreatedAt: string;
  lastInsightCreatedAt: string;
  now: Date;
  maxAgeDays?: number;
}): boolean {
  const insightAt = at(args.lastInsightCreatedAt);
  const analysisAt = at(args.latestAnalysisCreatedAt);
  if (Number.isNaN(insightAt) || Number.isNaN(analysisAt)) return false;
  const maxAgeMs = (args.maxAgeDays ?? INSIGHT_MAX_REUSE_DAYS) * 24 * 60 * 60 * 1000;
  return insightAt > analysisAt && args.now.getTime() - insightAt < maxAgeMs;
}

// Cache key for a saved course search: per person (so nobody else can write
// what they see), language and topic.
export function courseCacheKey(userId: string, locale: string, topic: string, format?: string | null): string {
  const clean = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
  return `courses:${userId}:${locale}:${clean(topic)}${format ? `:${clean(format)}` : ""}`;
}

export function isFresh(generatedAtIso: string, ttlDays: number, now: Date = new Date()): boolean {
  const t = at(generatedAtIso);
  return !Number.isNaN(t) && now.getTime() - t < ttlDays * 24 * 60 * 60 * 1000;
}
