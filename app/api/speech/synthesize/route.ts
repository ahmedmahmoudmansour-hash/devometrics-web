import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { synthesizeSpeechAzure, NAMED_VOICES, type NamedVoice } from "@/lib/speech/azureTts";
import { MAX_SPEECH_TEXT_LENGTH } from "@/lib/limits";

// Shared by both the AI Coach and the Roleplay simulator — one authenticated
// endpoint, since both just need "turn this text into audio in this voice."
// Moved from Speechmatics to Azure after a real, measured comparison on the
// test/azure-speech branch (see scripts/compare-speech-providers.mjs):
// Speechmatics' real-time STT failed 9/10 trials, Azure failed 0/10 — the
// same quota_exceeded problem this app already had a fallback for. Azure
// also has genuine native Arabic neural voices, unlike Speechmatics' TTS,
// which is English-only.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { text, voice, locale } = (await request.json()) as { text?: string; voice?: string; locale?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });
  if (text.length > MAX_SPEECH_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text is too long to narrate" }, { status: 400 });
  }
  if (!voice || !NAMED_VOICES.includes(voice as NamedVoice)) {
    return NextResponse.json({ error: "Invalid voice" }, { status: 400 });
  }

  try {
    const { audio } = await synthesizeSpeechAzure(text, voice as NamedVoice, locale === "ar" ? "ar" : "en");
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch {
    return NextResponse.json({ error: "Voice narration is temporarily unavailable" }, { status: 502 });
  }
}
