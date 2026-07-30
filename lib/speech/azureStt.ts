// Azure batch (short-audio) Speech-to-Text — used here for the STT-accuracy
// comparison against Speechmatics. This is the REST "short audio" endpoint,
// not the real-time streaming one; word-error-rate is a property of the
// recognizer itself, not of streaming vs. batch delivery, so it's a valid
// way to measure accuracy without needing the full WebSocket SDK wired up
// for a one-off test. Reference:
// https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text-short

export type AzureSttResult = { text: string; elapsedMs: number };

// Only two Content-Types are actually accepted by this endpoint per
// Microsoft's own docs — WAV/PCM at 16kHz mono, or OGG/Opus. No mp3
// support, so the audio fed in here must be synthesized (or recorded) as
// 16kHz mono PCM WAV, not the mp3 format used for production playback.
export async function transcribeAzure(audio: ArrayBuffer, locale: "en-US" | "ar-EG"): Promise<AzureSttResult> {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!apiKey || !region) throw new Error("Azure Speech key/region not configured");

  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`;

  const start = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json",
    },
    body: audio,
  });
  const elapsedMs = performance.now() - start;

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Azure STT error (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { DisplayText?: string; RecognitionStatus?: string };
  if (data.RecognitionStatus && data.RecognitionStatus !== "Success") {
    throw new Error(`Azure STT recognition status: ${data.RecognitionStatus}`);
  }
  return { text: data.DisplayText ?? "", elapsedMs };
}
