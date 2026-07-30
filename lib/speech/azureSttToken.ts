"use server";

// Short-lived token for the browser-side Azure Speech SDK (real-time STT) --
// the real subscription key can never reach the browser, same reasoning as
// lib/speech/sttToken.ts's Speechmatics equivalent. Azure's issueToken
// tokens are valid ~10 minutes (fixed by the service, unlike Speechmatics'
// configurable ttl) -- plenty for a single Coach/Roleplay session's
// continuous-recognition window.
export async function getAzureSpeechToken(): Promise<{ token: string; region: string }> {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!apiKey || !region) throw new Error("Azure Speech key/region not configured");

  const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": apiKey, "Content-Length": "0" },
  });
  if (!response.ok) {
    throw new Error(`Azure token issue failed (${response.status})`);
  }
  const token = await response.text();
  return { token, region };
}
