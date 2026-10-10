import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { buildPlatformChatSystemPrompt } from "@/lib/platformChat/systemPrompt";
import { isRateLimited, isRateLimitedShared } from "@/lib/platformChat/rateLimiter";
import {
  MAX_PLATFORM_CHAT_MESSAGE_LENGTH,
  MAX_PLATFORM_CHAT_HISTORY,
  MAX_PLATFORM_CHAT_HISTORY_ENTRY_LENGTH,
} from "@/lib/limits";
import { LOCALE_COOKIE, resolveApiLocale } from "@/lib/i18n/request";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ChatTurn = { role: "user" | "assistant"; content: string };

// The history comes from an unauthenticated client: keep only well-formed
// turns and bound each one, so a single request can't carry an arbitrarily
// large prompt to the paid API.
function sanitizeHistory(history: unknown): ChatTurn[] {
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

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  // Cheap per-process check first; then the database-backed limit that holds
  // across server instances and caps total use (migration 0196).
  if (isRateLimited(ip) || (await isRateLimitedShared(ip))) {
    return NextResponse.json(
      { error: "Too many messages — please wait a moment and try again." },
      { status: 429 }
    );
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message : "";
  const history = body.history;

  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_PLATFORM_CHAT_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_PLATFORM_CHAT_MESSAGE_LENGTH} characters)` },
      { status: 400 }
    );
  }

  // No DB persistence — this is unauthenticated, so history is client-held
  // and resubmitted each turn, capped to keep the request bounded.
  const trimmedHistory = sanitizeHistory(history);

  // No signed-in user on this unauthenticated widget, so no profile
  // fallback — just the locale cookie the site's own toggle sets (same
  // cookie anonymous marketing-site visitors already get, per
  // lib/i18n/request.ts).
  const locale = resolveApiLocale((await cookies()).get(LOCALE_COOKIE)?.value, undefined);

  let reply: string;
  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      system: buildPlatformChatSystemPrompt(locale),
      messages: [...trimmedHistory, { role: "user" as const, content: message }],
    });
    reply = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch {
    return NextResponse.json(
      { error: "The assistant is temporarily unavailable — please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ reply });
}
