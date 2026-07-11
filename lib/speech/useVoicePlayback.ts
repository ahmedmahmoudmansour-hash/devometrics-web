"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client-side counterpart to /api/speech/synthesize — fetches real audio
// (not instant, unlike browser speechSynthesis) and plays it once it
// arrives. One hook shared by Coach and Roleplay, since both just need
// "speak this text in this voice."

// Synthesis time scales with text length, so a long reply used to mean a
// long silent wait before ANY audio. Splitting the reply lets the first
// sentence be synthesized (fast — it's short) and start playing while the
// remainder is still being generated in parallel: perceived latency drops
// from "TTS time for the whole reply" to "TTS time for one sentence."
function splitForStreaming(text: string): string[] {
  const trimmed = text.trim();
  // Short replies gain nothing from splitting — one request is cheaper.
  if (trimmed.length <= 160) return [trimmed];
  // First sentence boundary after a minimum prefix (so "Hi." alone doesn't
  // become its own chunk) and within a cap (so a wall of text with no early
  // punctuation still splits somewhere reasonable).
  const searchRegion = trimmed.slice(30, 300);
  const match = /[.!?…]["')\]]?\s/.exec(searchRegion);
  if (!match) return [trimmed];
  const cut = 30 + match.index + match[0].length;
  const first = trimmed.slice(0, cut).trim();
  const rest = trimmed.slice(cut).trim();
  return rest ? [first, rest] : [first];
}

async function synthesize(text: string, voice: string): Promise<Blob> {
  const res = await fetch("/api/speech/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Could not play audio");
  }
  return res.blob();
}

export function useVoicePlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  // Bumped on every play()/stop() call and captured by each play() call's
  // closure — a stale token means "a newer play() or a stop() superseded
  // this one, abandon quietly." Without it, two overlapping play() calls
  // both finish and talk over each other.
  const requestIdRef = useRef(0);
  // Resolver for the "wait until this chunk finishes playing" promise —
  // held in a ref so stop() can release a paused chunk instead of leaving
  // the background playback loop awaiting an 'ended' event that a paused
  // <audio> will never fire.
  const chunkDoneRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    chunkDoneRef.current?.();
    chunkDoneRef.current = null;
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current = [];
    setPlaying(false);
    setLoading(false);
  }, []);

  // Returns whether playback actually started — callers that auto-play right
  // after a reply need this to know whether to fall back to a manual "Play"
  // button, rather than silently doing nothing when it fails (e.g. a strict
  // browser autoplay policy, or a synthesis error). Resolves as soon as the
  // FIRST chunk starts (matching the old single-chunk behavior); remaining
  // chunks continue in the background.
  const play = useCallback(
    async (text: string, voice: string): Promise<boolean> => {
      stop();
      const requestId = requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;
      setError(null);
      setLoading(true);

      // Claims the browser's "this play() is user-gesture-initiated" credit
      // RIGHT NOW, synchronously, before the code below awaits a ~1-2s
      // network round trip to synthesize the first chunk. Without this, a
      // manual "Play" click can go through Chrome/Edge's autoplay policy at
      // click-time but get silently rejected once .play() actually runs
      // after that delay — the exact "I click it and nothing happens" bug,
      // since a rejected promise here still gets caught below and reported,
      // but a user who doesn't scroll to see the small red error text just
      // experiences silence. Reusing THIS SAME <audio> element for the real
      // playback (not creating a fresh one later) is what makes the
      // unlock stick — some engines unlock per-element, not per-page.
      const primed = new Audio();
      primed.muted = true;
      primed.play().catch(() => {});

      const chunks = splitForStreaming(text);
      // All chunks synthesize in parallel — chunk 2 is usually ready by the
      // time chunk 1 finishes playing. Pre-attach a no-op catch so an early
      // stop() doesn't turn an abandoned in-flight request into an
      // unhandled-rejection console error.
      const blobPromises = chunks.map((c) => {
        const p = synthesize(c, voice);
        p.catch(() => {});
        return p;
      });

      const startChunk = async (index: number, reuse?: HTMLAudioElement): Promise<HTMLAudioElement> => {
        const blob = await blobPromises[index];
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        const audio = reuse ?? new Audio();
        audio.muted = false;
        audio.src = url;
        audioRef.current = audio;
        await audio.play();
        return audio;
      };

      const waitForEnd = (audio: HTMLAudioElement) =>
        new Promise<void>((resolve) => {
          chunkDoneRef.current = resolve;
          audio.onended = () => resolve();
        });

      try {
        const first = await startChunk(0, primed);
        if (isStale()) return false;
        setLoading(false);
        setPlaying(true);

        // Rest of the reply plays in the background after the first chunk —
        // errors here are non-fatal (the user already heard the opening;
        // worst case the tail is cut short rather than the whole reply
        // erroring out).
        void (async () => {
          try {
            await waitForEnd(first);
            for (let i = 1; i < blobPromises.length; i++) {
              if (isStale()) return;
              const audio = await startChunk(i);
              if (isStale()) return;
              await waitForEnd(audio);
            }
          } catch {
            // tail chunk failed — end playback quietly
          }
          if (!isStale()) setPlaying(false);
        })();

        return true;
      } catch (err) {
        if (isStale()) return false;
        // Logged, not just surfaced in the UI — a small red error line below
        // the fold is easy to miss; the console isn't.
        console.error("Voice playback failed:", err);
        setError(err instanceof Error ? err.message : "Could not play audio");
        setLoading(false);
        setPlaying(false);
        return false;
      }
    },
    [stop]
  );

  // Client-side navigation unmounts this component's owner (e.g. leaving a
  // Roleplay scenario) but doesn't touch the <audio> element sitting in
  // audioRef — it's outside React's render tree, so nothing tells it to
  // stop. Without this, a reply that's still playing (or still fetching)
  // keeps talking on whatever screen the user navigated to next.
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      audioRef.current?.pause();
      audioRef.current = null;
      chunkDoneRef.current?.();
      chunkDoneRef.current = null;
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
      objectUrlsRef.current = [];
    };
  }, []);

  return { play, stop, playing, loading, error };
}
