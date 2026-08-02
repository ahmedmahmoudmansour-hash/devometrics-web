// Throwaway script — real, measured comparison of Speechmatics vs Azure
// Speech for the metrics Ahmed asked for, run on the test/azure-speech
// branch before any production wiring decision. Self-contained (duplicates
// the minimal request logic from lib/speech/*.ts rather than importing
// them, same convention as this session's other throwaway scripts, since
// this is plain .mjs and those are .ts).
//
// Run from devometrics-web/:
//   node --env-file=.env.local scripts/compare-speech-providers.mjs

import { RealtimeClient } from "@speechmatics/real-time-client";
import { createSpeechmaticsJWT } from "@speechmatics/auth";

const SPEECHMATICS_KEY = process.env.SPEECHMATICS_API_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;
if (!SPEECHMATICS_KEY || !AZURE_KEY || !AZURE_REGION) {
  throw new Error("Need SPEECHMATICS_API_KEY, AZURE_SPEECH_KEY, and AZURE_SPEECH_REGION set");
}

// Real Fusha Arabic (not machine-transliterated) + English, coaching-shaped
// sentences — short enough to keep per-call cost trivial across ~2 dozen
// calls total, varied enough to not be a single lucky/unlucky sample.
const EN_SENTENCES = [
  "I think I'm ready for the promotion, but I'm not sure how to bring it up with my manager.",
  "Can you help me prepare for a difficult conversation about missed deadlines?",
  "What should I focus on this quarter to close my leadership gap?",
  "I just finished the negotiation exercise and I'm not sure how I did.",
  "How do I ask for a raise without sounding entitled?",
];
const AR_SENTENCES = [
  "أعتقد أنني جاهز للترقية، لكنني لست متأكدًا كيف أطرح الموضوع مع مديري.",
  "هل يمكنك مساعدتي في التحضير لمحادثة صعبة حول المواعيد النهائية الفائتة؟",
  "على ماذا يجب أن أركز هذا الربع لسد فجوتي في القيادة؟",
  "أنهيت للتو تمرين التفاوض ولست متأكدًا كيف كان أدائي.",
  "كيف أطلب زيادة في الراتب دون أن يبدو الأمر وكأنني أستحقها تلقائيًا؟",
];

// ---------- Azure TTS (mirrors lib/speech/azureTts.ts) ----------
const AZURE_VOICE = { en: "en-US-AvaNeural", ar: "ar-EG-SalmaNeural" };
function escapeSsml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
async function azureTts(text, lang) {
  const langAttr = lang === "ar" ? "ar-EG" : "en-US";
  const ssml = `<speak version="1.0" xml:lang="${langAttr}"><voice name="${AZURE_VOICE[lang]}">${escapeSsml(text)}</voice></speak>`;
  const start = performance.now();
  const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm",
      "User-Agent": "devometrics-test",
    },
    body: ssml,
  });
  const elapsedMs = performance.now() - start;
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), elapsedMs };
}

// ---------- Speechmatics TTS (mirrors lib/speech/speechmatics.ts) ----------
async function speechmaticsTts(text) {
  const start = performance.now();
  const res = await fetch(`https://preview.tts.speechmatics.com/generate/sarah`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SPEECHMATICS_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const elapsedMs = performance.now() - start;
  if (!res.ok) throw new Error(`Speechmatics TTS ${res.status}: ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()), elapsedMs };
}

// ---------- Azure STT batch (mirrors lib/speech/azureStt.ts) ----------
async function azureStt(wavBuffer, lang) {
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const start = performance.now();
  const res = await fetch(
    `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
      },
      body: wavBuffer,
    }
  );
  const elapsedMs = performance.now() - start;
  if (!res.ok) throw new Error(`Azure STT ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.DisplayText ?? "", elapsedMs, status: data.RecognitionStatus };
}

// ---------- WAV parsing (RIFF/PCM16 -> Float32, for Speechmatics real-time) ----------
function parseWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE file");
  }
  let offset = 12;
  let sampleRate = 16000;
  let dataStart = -1;
  let dataLength = 0;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") sampleRate = buf.readUInt32LE(offset + 12);
    if (chunkId === "data") {
      dataStart = offset + 8;
      dataLength = chunkSize;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (dataStart === -1) throw new Error("No data chunk found in WAV");
  const pcm16 = buf.subarray(dataStart, dataStart + dataLength);
  const float32 = new Float32Array(pcm16.length / 2);
  for (let i = 0; i < float32.length; i++) float32[i] = pcm16.readInt16LE(i * 2) / 32768;
  return { sampleRate, float32 };
}

// ---------- Speechmatics real-time STT (mirrors lib/roleplay/useSpeech.ts) ----------
async function speechmaticsRealtimeStt(float32, sampleRate, lang) {
  const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey: SPEECHMATICS_KEY, ttl: 60 });
  const client = new RealtimeClient({ appId: "devometrics-test" });
  let buffer = "";
  let finalText = "";
  const start = performance.now();

  client.addEventListener("receiveMessage", ({ data }) => {
    if (data.message === "AddTranscript") {
      for (const r of data.results) {
        const content = r.alternatives?.[0]?.content;
        if (!content) continue;
        buffer += (r.type === "punctuation" || !buffer ? "" : " ") + content;
      }
    } else if (data.message === "EndOfUtterance") {
      finalText += (finalText ? " " : "") + buffer.trim();
      buffer = "";
    }
  });

  await client.start(jwt, {
    transcription_config: { language: lang === "ar" ? "ar" : "en", max_delay: 2, conversation_config: { end_of_utterance_silence_trigger: 2 } },
    audio_format: { type: "raw", encoding: "pcm_f32le", sample_rate: sampleRate },
  });

  // Feed in ~200ms chunks, matching roughly what a real mic stream sends.
  const chunkSize = Math.floor(sampleRate * 0.2);
  for (let i = 0; i < float32.length; i += chunkSize) {
    client.sendAudio(float32.subarray(i, i + chunkSize).buffer);
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise((r) => setTimeout(r, 3000)); // let EndOfUtterance land
  await client.stopRecognition({ noTimeout: true }).catch(() => {});
  const elapsedMs = performance.now() - start;
  return { text: (finalText + " " + buffer).trim(), elapsedMs };
}

// ---------- Word Error Rate ----------
function wer(reference, hypothesis) {
  const ref = reference.trim().split(/\s+/).filter(Boolean);
  const hyp = hypothesis.trim().normalize("NFKC").split(/\s+/).filter(Boolean);
  const d = Array.from({ length: ref.length + 1 }, (_, i) => new Array(hyp.length + 1).fill(0));
  for (let i = 0; i <= ref.length; i++) d[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      if (ref[i - 1] === hyp[j - 1]) d[i][j] = d[i - 1][j - 1];
      else d[i][j] = 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return ref.length === 0 ? 0 : d[ref.length][hyp.length] / ref.length;
}

// ==================== RUN ====================
const results = { tts: [], sttAccuracy: [], sessionTrials: { azure: [], speechmatics: [] } };

console.log("=".repeat(72) + "\nTTS: latency comparison (Azure vs Speechmatics)\n" + "=".repeat(72));
for (const [lang, sentences] of [["en", EN_SENTENCES], ["ar", AR_SENTENCES]]) {
  for (const text of sentences) {
    const az = await azureTts(text, lang).catch((e) => ({ error: e.message }));
    const sm = lang === "en" ? await speechmaticsTts(text).catch((e) => ({ error: e.message })) : null;
    results.tts.push({ lang, text, azureMs: az.elapsedMs, azureError: az.error, speechmaticsMs: sm?.elapsedMs, speechmaticsError: sm?.error });
    console.log(
      `[${lang}] "${text.slice(0, 40)}..." — Azure: ${az.elapsedMs ? az.elapsedMs.toFixed(0) + "ms" : "FAILED: " + az.error}` +
        (sm ? `  Speechmatics: ${sm.elapsedMs ? sm.elapsedMs.toFixed(0) + "ms" : "FAILED: " + sm.error}` : "  Speechmatics: (skipped — Arabic voice not available)")
    );
  }
}

console.log("\n" + "=".repeat(72) + "\nSTT accuracy: both engines transcribe the SAME Azure-synthesized audio\n" + "=".repeat(72));
for (const [lang, sentences] of [["en", EN_SENTENCES], ["ar", AR_SENTENCES]]) {
  for (const text of sentences) {
    const { audio } = await azureTts(text, lang);
    const { sampleRate, float32 } = parseWav(audio);

    const azResult = await azureStt(audio, lang).catch((e) => ({ error: e.message }));
    const smResult = await speechmaticsRealtimeStt(float32, sampleRate, lang).catch((e) => ({ error: e.message }));

    const azWer = azResult.text ? wer(text, azResult.text) : null;
    const smWer = smResult.text ? wer(text, smResult.text) : null;
    results.sttAccuracy.push({ lang, text, azure: azResult, speechmatics: smResult, azWer, smWer });

    console.log(`\n[${lang}] Reference: "${text}"`);
    console.log(`  Azure:        "${azResult.text ?? "FAILED: " + azResult.error}"  WER=${azWer !== null ? azWer.toFixed(2) : "n/a"}  (${azResult.elapsedMs?.toFixed(0)}ms)`);
    console.log(`  Speechmatics: "${smResult.text ?? "FAILED: " + smResult.error}"  WER=${smWer !== null ? smWer.toFixed(2) : "n/a"}  (${smResult.elapsedMs?.toFixed(0)}ms)`);
  }
}

console.log("\n" + "=".repeat(72) + "\nSession reliability: 10 trials each\n" + "=".repeat(72));
const { audio: sampleAudio } = await azureTts(EN_SENTENCES[0], "en");
const { sampleRate: srSample, float32: sampleFloat32 } = parseWav(sampleAudio);
for (let i = 0; i < 10; i++) {
  const azOk = await azureStt(sampleAudio, "en").then(() => true).catch(() => false);
  results.sessionTrials.azure.push(azOk);
  const smOk = await speechmaticsRealtimeStt(sampleFloat32, srSample, "en").then((r) => !!r.text).catch(() => false);
  results.sessionTrials.speechmatics.push(smOk);
  console.log(`Trial ${i + 1}: Azure ${azOk ? "OK" : "FAILED"}, Speechmatics ${smOk ? "OK" : "FAILED"}`);
}

// ==================== SUMMARY ====================
function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
const azureTtsMs = results.tts.map((r) => r.azureMs).filter((x) => x != null);
const smTtsMs = results.tts.filter((r) => r.lang === "en").map((r) => r.speechmaticsMs).filter((x) => x != null);
const azureWers = { en: results.sttAccuracy.filter((r) => r.lang === "en" && r.azWer != null).map((r) => r.azWer), ar: results.sttAccuracy.filter((r) => r.lang === "ar" && r.azWer != null).map((r) => r.azWer) };
const smWers = { en: results.sttAccuracy.filter((r) => r.lang === "en" && r.smWer != null).map((r) => r.smWer), ar: results.sttAccuracy.filter((r) => r.lang === "ar" && r.smWer != null).map((r) => r.smWer) };
const azureFailRate = 1 - avg(results.sessionTrials.azure.map(Number));
const smFailRate = 1 - avg(results.sessionTrials.speechmatics.map(Number));

console.log("\n" + "=".repeat(72) + "\nSUMMARY\n" + "=".repeat(72));
console.log(`Avg TTS latency — Azure: ${avg(azureTtsMs)?.toFixed(0)}ms   Speechmatics (EN only): ${avg(smTtsMs)?.toFixed(0)}ms`);
console.log(`Avg STT WER (EN) — Azure: ${avg(azureWers.en)?.toFixed(3)}   Speechmatics: ${avg(smWers.en)?.toFixed(3)}`);
console.log(`Avg STT WER (AR) — Azure: ${avg(azureWers.ar)?.toFixed(3)}   Speechmatics: ${avg(smWers.ar)?.toFixed(3)}`);
console.log(`Session failure rate (10 trials) — Azure: ${(azureFailRate * 100).toFixed(0)}%   Speechmatics: ${(smFailRate * 100).toFixed(0)}%`);
console.log("\nFull results JSON below (for building the final table):\n");
console.log(JSON.stringify(results, null, 2));
