"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client-side counterpart to /api/speech/synthesize — fetches real audio
// (not instant, unlike browser speechSynthesis) and plays it once it
// arrives. One hook shared by Coach and Roleplay.
//
// KPI this file optimizes for: Time To First Audio (TTFA), not total
// response time. The old design waited for the ENTIRE LLM reply to finish
// generating, THEN split it into chunks and started TTS — meaning TTFA was
// bounded below by the full LLM generation time. This design instead
// listens to the LLM's token stream directly (via startStream/push/end) and
// fires off TTS synthesis for each sentence the moment it completes, so the
// first sentence is speaking while the LLM is still writing the rest.
// TTFA is now bounded by (time for the LLM to produce one sentence) +
// (TTS synthesis time for that one sentence) — both real, unavoidable
// vendor latencies, but no longer stacked with the full reply length.

const SENTENCE_BOUNDARY = /[.!?…]["')\]]?\s/;

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

export type VoiceStreamHandle = {
  // Feed the newest text DELTA (not the full accumulated reply) as it
  // arrives from the LLM stream.
  push: (textDelta: string) => void;
  // Call once the LLM stream is done — flushes any trailing partial
  // sentence as a final chunk.
  end: () => void;
};

export function useVoicePlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  // Bumped on every startStream()/stop() call and captured by that call's
  // closure — a stale token means "superseded, abandon quietly."
  const requestIdRef = useRef(0);
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

  // Starts a playback session whose text isn't fully known yet — sentences
  // are synthesized and queued as push() delivers them. Returns a handle
  // (not a promise of completion) since the caller doesn't know when
  // audio's done, only when it's finished SENDING text.
  const startStream = useCallback(
    (
      voice: string,
      callbacks?: {
        onFirstChunkFailed?: () => void;
        // Applied to each COMPLETE sentence right before synthesis, not to
        // raw stream deltas (which are arbitrary token fragments — running
        // a regex like stage-direction-stripping on those could clip a
        // *not-yet-closed* pattern). Roleplay uses this to strip
        // *stage directions* before they'd otherwise be read aloud.
        transformChunk?: (text: string) => string;
      }
    ): VoiceStreamHandle => {
      stop();
      const requestId = requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;
      setError(null);
      setLoading(true);

      // Claims the browser's "this play() is user-gesture-initiated" credit
      // synchronously, before any network wait — see useVoicePlayback's
      // module comment / the commit that introduced this for the bug it
      // fixes (Play button silently rejected by autoplay policy).
      const primed = new Audio();
      primed.muted = true;
      primed.play().catch(() => {});

      let buffer = "";
      let ended = false;
      const synthesisQueue: Promise<Blob>[] = [];
      let waiter: (() => void) | null = null;
      const wake = () => {
        waiter?.();
        waiter = null;
      };

      function queueChunk(text: string) {
        const transformed = (callbacks?.transformChunk?.(text) ?? text).trim();
        if (!transformed) return; // e.g. a chunk that was ONLY a stage direction
        const p = synthesize(transformed, voice);
        p.catch(() => {});
        synthesisQueue.push(p);
        wake();
      }

      function flush(final: boolean) {
        for (;;) {
          const match = SENTENCE_BOUNDARY.exec(buffer);
          if (!match) break;
          const cut = match.index + match[0].length;
          queueChunk(buffer.slice(0, cut));
          buffer = buffer.slice(cut);
        }
        if (final && buffer.trim()) {
          queueChunk(buffer);
          buffer = "";
        }
      }

      async function playbackLoop() {
        let index = 0;
        let isFirst = true;
        try {
          for (;;) {
            while (index >= synthesisQueue.length) {
              if (ended) return; // nothing queued and nothing more coming
              await new Promise<void>((resolve) => {
                waiter = resolve;
              });
              if (isStale()) return;
            }
            const blob = await synthesisQueue[index];
            if (isStale()) return;
            const url = URL.createObjectURL(blob);
            objectUrlsRef.current.push(url);
            const audio = isFirst ? primed : new Audio();
            audio.muted = false;
            audio.src = url;
            audioRef.current = audio;
            if (isFirst) {
              setLoading(false);
              setPlaying(true);
            }
            try {
              await audio.play();
            } catch (err) {
              if (isFirst) {
                console.error("Voice playback failed to start:", err);
                callbacks?.onFirstChunkFailed?.();
                setLoading(false);
                setPlaying(false);
                if (!isStale()) setError(err instanceof Error ? err.message : "Could not play audio");
              }
              return;
            }
            isFirst = false;
            await new Promise<void>((resolve) => {
              chunkDoneRef.current = resolve;
              audio.onended = () => resolve();
            });
            if (isStale()) return;
            index++;
          }
        } finally {
          if (!isStale()) setPlaying(false);
        }
      }

      void playbackLoop();

      return {
        push: (delta: string) => {
          if (isStale()) return;
          buffer += delta;
          flush(false);
        },
        end: () => {
          if (isStale()) return;
          flush(true);
          ended = true;
          wake();
        },
      };
    },
    [stop]
  );

  // Convenience wrapper for text that's already fully known (the manual
  // "Play" button replaying a past message) — same engine, one push + end.
  // Resolves true/false based on whether the FIRST chunk actually started,
  // matching the old play()'s contract so existing callers don't change.
  const play = useCallback(
    (text: string, voice: string): Promise<boolean> => {
      return new Promise((resolve) => {
        let settled = false;
        const handle = startStream(voice, {
          onFirstChunkFailed: () => {
            if (!settled) {
              settled = true;
              resolve(false);
            }
          },
        });
        handle.push(text);
        handle.end();
        // No explicit "first chunk started" callback exists (only a
        // failure one) — resolve true shortly after kickoff unless the
        // failure path already fired. This mirrors the previous
        // implementation's timing closely enough for the manual-replay
        // button's autoplay-fallback UI, which only needs to distinguish
        // "worked" from "blocked," not exact millisecond timing.
        setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(true);
          }
        }, 50);
      });
    },
    [startStream]
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

  return { play, startStream, stop, playing, loading, error };
}
