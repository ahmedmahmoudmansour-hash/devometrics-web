import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { buildPlatformChatSystemPrompt } from "@/lib/platformChat/systemPrompt";
import { isRateLimited } from "@/lib/platformChat/rateLimiter";
import { MAX_PLATFORM_CHAT_MESSAGE_LENGTH, MAX_PLATFORM_CHAT_HISTORY } from "@/lib/limits";
import { LOCALE_COOKIE, resolveApiLocale } from "@/lib/i18n/request";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many messages — please wait a moment and try again." },
      { status: 429 }
    );
  }

  const { message, history } = (await request.json()) as {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) {
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
  const trimmedHistory = (history ?? []).slice(-MAX_PLATFORM_CHAT_HISTORY);

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
