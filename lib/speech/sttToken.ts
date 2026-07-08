"use server";

import { createSpeechmaticsJWT } from "@speechmatics/auth";

// Short-lived (60s) token minted server-side from the same account/key as
// the TTS voice (lib/speech/speechmatics.ts) -- the real API key can never
// be sent to the browser, so the real-time WebSocket auths with this
// temporary JWT instead (browsers can't send custom Authorization headers
// on a WebSocket handshake).
export async function getSpeechToTextToken(): Promise<string> {
  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) throw new Error("Speechmatics API key not configured");
  return createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 60 });
}
