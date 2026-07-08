export const SPEECHMATICS_VOICES = ["sarah", "theo", "megan", "jack"] as const;
export type SpeechmaticsVoice = (typeof SPEECHMATICS_VOICES)[number];

// Real, paid-tier-capable TTS — the upgrade from the free browser
// speechSynthesis fallback still used for Roleplay's speech *input*
// (lib/roleplay/useSpeech.ts). Free tier today (1M characters/month), same
// API either way, so upgrading Speechmatics' own plan later needs no code
// changes here.
export async function synthesizeSpeech(text: string, voice: SpeechmaticsVoice): Promise<ArrayBuffer> {
  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) throw new Error("Speechmatics API key not configured");

  const response = await fetch(`https://preview.tts.speechmatics.com/generate/${voice}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Speechmatics error (${response.status}): ${detail}`);
  }

  return response.arrayBuffer();
}
