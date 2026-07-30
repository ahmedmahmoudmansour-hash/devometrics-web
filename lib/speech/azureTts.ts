// Azure Neural TTS — the replacement for Speechmatics' preview-tier TTS
// endpoint. Same 4 named-character voices the app already exposes
// (sarah/theo/megan/jack), but each maps to a real, distinct Azure voice
// per language instead of forcing an English voice onto Arabic text.
// Voice names confirmed against Microsoft's own current voice list, not
// guessed: https://learn.microsoft.com/azure/ai-services/speech-service/language-support

export const NAMED_VOICES = ["sarah", "theo", "megan", "jack"] as const;
export type NamedVoice = (typeof NAMED_VOICES)[number];

const VOICE_MAP: Record<"en" | "ar", Record<NamedVoice, string>> = {
  en: {
    sarah: "en-US-AvaNeural",
    megan: "en-US-EmmaNeural",
    theo: "en-US-AndrewNeural",
    jack: "en-US-BrianNeural",
  },
  ar: {
    sarah: "ar-EG-SalmaNeural",
    megan: "ar-AE-FatimaNeural",
    theo: "ar-SA-HamedNeural",
    jack: "ar-EG-ShakirNeural",
  },
};

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function resolveAzureVoice(namedVoice: NamedVoice, locale: "en" | "ar"): string {
  return VOICE_MAP[locale][namedVoice];
}

// Returns the raw audio bytes plus how long the HTTP call itself took —
// the latter feeds directly into the "time to first audio" comparison,
// since this endpoint returns the complete file in one response (no
// server-side chunked streaming), same measurement basis as Speechmatics'
// synthesizeSpeech for a fair side-by-side.
export async function synthesizeSpeechAzure(
  text: string,
  namedVoice: NamedVoice,
  locale: "en" | "ar",
  // "mp3" for production playback (smaller payload); "wav" produces
  // 16kHz mono PCM specifically so the STT-accuracy test script can feed
  // the output straight into transcribeAzure/Speechmatics batch STT,
  // both of which only accept that exact format.
  outputFormat: "mp3" | "wav" = "mp3"
): Promise<{ audio: ArrayBuffer; elapsedMs: number }> {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!apiKey || !region) throw new Error("Azure Speech key/region not configured");

  const voiceName = resolveAzureVoice(namedVoice, locale);
  const langAttr = locale === "ar" ? "ar-EG" : "en-US";
  const ssml = `<speak version="1.0" xml:lang="${langAttr}"><voice name="${voiceName}">${escapeSsml(text)}</voice></speak>`;
  const azureOutputFormat = outputFormat === "wav" ? "riff-16khz-16bit-mono-pcm" : "audio-16khz-64kbitrate-mono-mp3";

  const start = performance.now();
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": azureOutputFormat,
      "User-Agent": "devometrics",
    },
    body: ssml,
  });
  const elapsedMs = performance.now() - start;

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Azure TTS error (${response.status}): ${detail}`);
  }

  return { audio: await response.arrayBuffer(), elapsedMs };
}
