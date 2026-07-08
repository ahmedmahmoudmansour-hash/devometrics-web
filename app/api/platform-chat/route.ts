import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PLATFORM_CHAT_SYSTEM_PROMPT } from "@/lib/platformChat/systemPrompt";
import { isRateLimited } from "@/lib/platformChat/rateLimiter";
import { MAX_PLATFORM_CHAT_MESSAGE_LENGTH, MAX_PLATFORM_CHAT_HISTORY } from "@/lib/limits";

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

  let reply: string;
  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      system: PLATFORM_CHAT_SYSTEM_PROMPT,
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
