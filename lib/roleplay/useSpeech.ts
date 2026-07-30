"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason } from "microsoft-cognitiveservices-speech-sdk";
import { getAzureSpeechToken } from "@/lib/speech/azureSttToken";

// Minimal shape of the non-standard Web Speech API — not in TS's default DOM
// lib since it's still webkit-prefixed in most browsers. This is now only
// the *fallback* path: used when Azure real-time transcription (below)
// can't be reached — no key configured, mic setup fails, or the service is
// briefly unreachable. Chrome supports it reliably; Safari and Firefox are
// hit-or-miss, so it still degrades to typing from there.
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

// Azure's SDK captures the mic itself (AudioConfig.fromDefaultMicrophoneInput)
// rather than needing a hand-rolled AudioWorklet, so this only needs to rule
// out environments without getUserMedia at all.
function supportsAzureStt(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && "mediaDevices" in navigator;
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

export function useSpeechInput(onResult: (transcript: string) => void, locale: "en" | "ar" = "en") {
  const t = useTranslations("speechErrors");
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
  // True from the moment a fallback engine is spun up until it's genuinely
  // stopped (not merely restarted after a silence timeout). Azure failure
  // can be reported through more than one path (a rejected start callback
  // AND a "canceled" event can both fire for the same underlying failure),
  // and without this guard both would call startBrowserFallback(), spinning
  // up two separate SpeechRecognition instances against the same
  // microphone — the doubled/garbled-transcript bug this guard exists to
  // prevent (confirmed live in this exact codebase before this guard).
  const fallbackActiveRef = useRef(false);
  const browserSupported = useSyncExternalStore(
    noopSubscribe,
    () => getSpeechRecognition() !== null,
    getServerSnapshot
  );

  // Azure real-time transcription — primary engine (moved from Speechmatics
  // after a real, measured comparison on the test/azure-speech branch:
  // Speechmatics' real-time STT failed 9 of 10 trials with quota_exceeded,
  // Azure failed 0 of 10, and Azure's word-error-rate was roughly 100x
  // better on the same test audio in both English and Arabic).
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const azureSupported = useSyncExternalStore(noopSubscribe, supportsAzureStt, getServerSnapshot);
  const supported = azureSupported || browserSupported;

  const stopAzure = useCallback(() => {
    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(
        () => recognizer.close(),
        () => recognizer.close()
      );
    }
  }, []);

  const startBrowserFallback = useCallback(() => {
    // Both an Azure "canceled" event and a rejected start callback can
    // independently call this for the same failure — only the first should
    // actually spin up an engine.
    if (fallbackActiveRef.current) return;
    const RecognitionCtor = getSpeechRecognition();
    if (!RecognitionCtor) {
      setListening(false);
      setError(t("voiceInputUnavailable"));
      return;
    }
    fallbackActiveRef.current = true;
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
      fallbackActiveRef.current = false;
      setListening(false);
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError(t("micBlocked"));
      } else if (code === "network") {
        setError(t("networkUnreachable"));
      } else {
        setError(t("micStopped"));
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
      fallbackActiveRef.current = false;
      setListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onResult, t]);

  const start = useCallback(async () => {
    setError(null);
    wantListeningRef.current = true;
    if (!supportsAzureStt()) {
      startBrowserFallback();
      return;
    }
    try {
      const { token, region } = await getAzureSpeechToken();
      const speechConfig = SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = locale === "ar" ? "ar-EG" : "en-US";

      const audioConfig = AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      // Fires once per finished utterance — Azure's own silence-based
      // boundary detection, the equivalent of Speechmatics' EndOfUtterance.
      recognizer.recognized = (_sender, event) => {
        if (event.result.reason === ResultReason.RecognizedSpeech && event.result.text.trim()) {
          onResult(event.result.text.trim());
        }
      };
      recognizer.canceled = (_sender, event) => {
        console.error("Azure real-time STT canceled, falling back:", event.errorDetails);
        stopAzure();
        startBrowserFallback();
      };
      recognizer.sessionStopped = () => setListening(false);

      await new Promise<void>((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(resolve, reject);
      });
      setListening(true);
    } catch (err) {
      console.error("Azure STT unavailable, falling back to browser recognition:", err);
      stopAzure();
      // Mic permission denial is the one failure the fallback can't fix —
      // the browser engine needs the same permission. Name it instead of
      // silently trying a second engine that will also fail.
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        wantListeningRef.current = false;
        setError(t("micBlocked"));
        setListening(false);
        return;
      }
      startBrowserFallback();
    }
  }, [onResult, startBrowserFallback, stopAzure, t, locale]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    stopAzure();
    recognitionRef.current?.stop();
    setListening(false);
  }, [stopAzure]);

  // Same reasoning as lib/speech/useVoicePlayback.ts — leaving a scenario
  // mid-recording shouldn't leave the mic and connection running in the
  // background.
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      stopAzure();
      recognitionRef.current?.stop();
    };
  }, [stopAzure]);

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

// The "sanitizeForSpeech" this file's other comment referenced but never
// actually implemented — built now after confirming live that Azure's
// Arabic voice read Coach's **bold** markers as "نجمة نجمة" (literally
// "star star"). renderInlineMarkdown.tsx already established **bold** is
// the one markdown construct that actually shows up in Coach/Roleplay
// output in practice — this keeps the enclosed text (unlike
// stripStageDirections, which deletes the whole span) since Coach's bold
// text is real content, not a stage direction to discard. Em dashes and
// curly quotes get normalized too, since several TTS voices read those
// literally — deliberately NOT applied to the visible transcript, only
// right before synthesis, so the on-screen text keeps its real formatting.
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/—/g, ", ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}
