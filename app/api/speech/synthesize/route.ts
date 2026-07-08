import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { synthesizeSpeech, SPEECHMATICS_VOICES, type SpeechmaticsVoice } from "@/lib/speech/speechmatics";
import { MAX_SPEECH_TEXT_LENGTH } from "@/lib/limits";

// Shared by both the AI Coach and the Roleplay simulator — one authenticated
// endpoint, since both just need "turn this text into audio in this voice."
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { text, voice } = (await request.json()) as { text?: string; voice?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });
  if (text.length > MAX_SPEECH_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text is too long to narrate" }, { status: 400 });
  }
  if (!voice || !SPEECHMATICS_VOICES.includes(voice as SpeechmaticsVoice)) {
    return NextResponse.json({ error: "Invalid voice" }, { status: 400 });
  }

  try {
    const audio = await synthesizeSpeech(text, voice as SpeechmaticsVoice);
    return new NextResponse(audio, { headers: { "Content-Type": "audio/wav" } });
  } catch {
    return NextResponse.json({ error: "Voice narration is temporarily unavailable" }, { status: 502 });
  }
}
