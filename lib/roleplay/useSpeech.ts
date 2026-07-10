"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RealtimeClient } from "@speechmatics/real-time-client";
import { PCMRecorder } from "@speechmatics/browser-audio-input";
import { getSpeechToTextToken } from "@/lib/speech/sttToken";

// Minimal shape of the non-standard Web Speech API — not in TS's default DOM
// lib since it's still webkit-prefixed in most browsers. This is now only
// the *fallback* path: used when Speechmatics real-time transcription
// (below) can't be reached — no key configured, mic/WebSocket setup fails,
// or the account's real-time quota runs out. Chrome supports it reliably;
// Safari and Firefox are hit-or-miss, so it still degrades to typing from
// there.
type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionEvent = { results: ArrayLike<ArrayLike<SpeechRecognitionResult>> };
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

// Real-time transcription needs a mic (getUserMedia) and an AudioWorklet to
// convert captured audio to PCM before streaming it to Speechmatics — both
// are widely supported, but this keeps old/unusual browsers from silently
// hanging on start().
function supportsSpeechmatics(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "mediaDevices" in navigator &&
    typeof AudioWorkletNode !== "undefined"
  );
}

// Feature support never changes after the page loads, so there's nothing to
// subscribe to — this just needs a snapshot read that's safe during SSR
// (no window) and correct once hydrated on the client, which is exactly
// what useSyncExternalStore is for.
function noopSubscribe() {
  return () => {};
}
function getServerSnapshot() {
  return false;
}

export function useSpeechInput(onResult: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  // Surfaced to the UI — a mic that silently does nothing is
  // indistinguishable from a mic that's broken, which testers report as
  // "not working" with no way to tell us why.
  const [error, setError] = useState<string | null>(null);
  // Whether the USER still wants the mic on — distinct from whether the
  // browser engine happens to be running. Chrome/Edge recognition kills
  // itself after ~8s of silence ("no-speech") or randomly ("network"/
  // "aborted"); as long as this is true, onend just restarts it instead of
  // reporting "the microphone stopped" for what was really just silence.
  const wantListeningRef = useRef(false);

  // Browser SpeechRecognition fallback
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const browserSupported = useSyncExternalStore(
    noopSubscribe,
    () => getSpeechRecognition() !== null,
    getServerSnapshot
  );

  // Speechmatics real-time transcription (same paid vendor as the TTS
  // voice, same free-tier-first, upgrade-later posture)
  const clientRef = useRef<RealtimeClient | null>(null);
  const recorderRef = useRef<PCMRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Accumulates words between EndOfUtterance boundaries (Speechmatics
  // detects ~1s of silence and emits one) — that boundary is what stands in
  // for the Web Speech API's "one onresult per finished phrase" behavior,
  // since AddTranscript itself streams in continuously, not per-utterance.
  const bufferRef = useRef("");
  const speechmaticsSupported = useSyncExternalStore(
    noopSubscribe,
    supportsSpeechmatics,
    getServerSnapshot
  );
  const supported = speechmaticsSupported || browserSupported;

  const stopSpeechmatics = useCallback(() => {
    recorderRef.current?.stopRecording();
    recorderRef.current = null;
    clientRef.current?.stopRecognition({ noTimeout: true }).catch(() => {});
    clientRef.current = null;
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close().catch(() => {});
    }
    audioContextRef.current = null;
    bufferRef.current = "";
  }, []);

  const startBrowserFallback = useCallback(() => {
    const RecognitionCtor = getSpeechRecognition();
    if (!RecognitionCtor) {
      setListening(false);
      setError("Voice input isn't available in this browser — Chrome works best, or type instead.");
      return;
    }
    const recognition = new RecognitionCtor();
    // continuous: true — without this, recognition stops after a single
    // utterance and the mic button has to be clicked again before every
    // single thing the user says. With it, the mic stays listening across
    // the whole exchange (each finished phrase still fires its own onresult,
    // handled below) until the user explicitly clicks stop.
    recognition.continuous = true;
    recognition.interimResults = false;
    // Hardcoding "en-US" forces Chrome's US-English acoustic model on every
    // accent. navigator.language reflects the browser's actual locale, which
    // is a closer acoustic match for non-US-English speakers (e.g. en-GB,
    // ar-EG) and reduces the mis-hearing this is meant to fix.
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      onResult(transcript);
    };
    recognition.onerror = (event) => {
      const code = event?.error ?? "";
      // no-speech = the user just hadn't said anything yet; aborted = we (or
      // the browser) restarted it. Neither is a real failure — onend's
      // restart handles them. Everything else is worth telling the user.
      if (code === "no-speech" || code === "aborted") return;
      wantListeningRef.current = false;
      setListening(false);
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone access is blocked — allow the mic for this site in your browser, then try again.");
      } else if (code === "network") {
        setError("The browser's speech service couldn't be reached — Chrome is the most reliable, or type instead.");
      } else {
        setError("The microphone stopped — check mic permission for this site and try again.");
      }
    };
    recognition.onend = () => {
      // The engine self-terminates constantly in continuous mode (silence
      // timeouts, service hiccups). If the user never clicked stop, bring it
      // straight back instead of quietly going deaf.
      if (wantListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // fall through to reporting stopped
        }
      }
      setListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onResult]);

  const start = useCallback(async () => {
    setError(null);
    wantListeningRef.current = true;
    if (!supportsSpeechmatics()) {
      startBrowserFallback();
      return;
    }
    try {
      const jwt = await getSpeechToTextToken();

      const audioContext = new AudioContext(
        navigator.userAgent.includes("Firefox") ? undefined : { sampleRate: 16000 }
      );
      audioContextRef.current = audioContext;

      const recorder = new PCMRecorder("/js/pcm-audio-worklet.min.js");
      recorderRef.current = recorder;

      const client = new RealtimeClient({ appId: "devometrics" });
      clientRef.current = client;

      recorder.addEventListener("audio", (event) => {
        try {
          client.sendAudio(event.data);
        } catch {
          // Socket not open yet (or already torn down) — drop this chunk
          // rather than throw mid-recording.
        }
      });

      client.addEventListener("receiveMessage", ({ data }) => {
        if (data.message === "AddTranscript") {
          for (const r of data.results) {
            const content = r.alternatives?.[0]?.content;
            if (!content) continue;
            bufferRef.current += (r.type === "punctuation" || !bufferRef.current ? "" : " ") + content;
          }
        } else if (data.message === "EndOfUtterance") {
          const utterance = bufferRef.current.trim();
          bufferRef.current = "";
          if (utterance) onResult(utterance);
        } else if (data.message === "Error") {
          console.error("Speechmatics real-time error, falling back:", data);
          stopSpeechmatics();
          startBrowserFallback();
        }
      });

      client.addEventListener("socketStateChange", ({ socketState }) => {
        if (socketState === "closed") setListening(false);
      });

      await client.start(jwt, {
        transcription_config: {
          language: "en",
          max_delay: 2,
          // 1s fired on natural mid-sentence thinking pauses, sending the
          // half-finished thought and making the coach "interrupt" the user.
          // 2.2s tolerates a normal pause; the trade-off is a slightly
          // longer wait after genuinely finishing before the reply starts.
          conversation_config: { end_of_utterance_silence_trigger: 2.2 },
        },
        audio_format: { type: "raw", encoding: "pcm_f32le", sample_rate: audioContext.sampleRate },
      });
      await recorder.startRecording({ audioContext });
      setListening(true);
    } catch (err) {
      console.error("Speechmatics STT unavailable, falling back to browser recognition:", err);
      stopSpeechmatics();
      // Mic permission denial is the one failure the fallback can't fix —
      // the browser engine needs the same permission. Name it instead of
      // silently trying a second engine that will also fail.
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        wantListeningRef.current = false;
        setError("Microphone access is blocked — allow the mic for this site in your browser, then try again.");
        setListening(false);
        return;
      }
      startBrowserFallback();
    }
  }, [onResult, startBrowserFallback, stopSpeechmatics]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    stopSpeechmatics();
    recognitionRef.current?.stop();
    setListening(false);
  }, [stopSpeechmatics]);

  // Same reasoning as lib/speech/useVoicePlayback.ts — leaving a scenario
  // mid-recording shouldn't leave the mic and socket running in the
  // background.
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      stopSpeechmatics();
      recognitionRef.current?.stop();
    };
  }, [stopSpeechmatics]);

  return { listening, supported, start, stop, error };
}

// Strips characters that read out literally as words on several common
// system voices (notably Windows SAPI defaults) instead of being treated as
// silent punctuation — em dashes, curly quotes, and repeated
// ellipses/periods are the main offenders, and Claude's own writing style
// uses em dashes and curly quotes constantly, so this isn't a rare edge
// case for AI-generated dialogue. Also drops *asterisk-wrapped stage
// directions* entirely (confirmed live in a real roleplay reply,
// "*Alex nods slowly...*") — a character shouldn't narrate its own body
// language out loud, and literal asterisks read even worse.
// Exported separately from sanitizeForSpeech since the other substitutions
// there (em dash -> comma, curly quotes -> straight) are speech-specific and
// would look wrong in the on-screen transcript — only the stage-direction
// strip applies to both. The system prompt now also instructs the model not
// to write these in the first place; this is the visual-side safety net for
// whatever slips through.
export function stripStageDirections(text: string): string {
  // Double-asterisk pairs first: trying the single-asterisk pattern first
  // on "**nods**" matches only the inner "*nods*" (regex needs a
  // non-asterisk char right after the opening *, so it can't start at the
  // very first character), leaving the outer two asterisks behind as
  // stray "**" in the output. Matching **-wrapped spans first consumes
  // them whole.
  return text.replace(/\*\*[^*]+\*\*/g, "").replace(/\*[^*]+\*/g, "").trim();
}
