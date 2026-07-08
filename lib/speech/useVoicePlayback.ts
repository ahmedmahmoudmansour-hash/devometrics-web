"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client-side counterpart to /api/speech/synthesize — fetches real audio
// (not instant, unlike browser speechSynthesis) and plays it once it
// arrives. One hook shared by Coach and Roleplay, since both just need
// "speak this text in this voice."
export function useVoicePlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Bumped on every play() call and captured by that call's closure — if a
  // second play() starts before the first one's fetch resolves, the first
  // call's response arrives to find the token stale and discards itself
  // instead of also calling .play(). Without this, two overlapping calls
  // (e.g. autoplay firing for a new reply while a manual replay of an
  // earlier message is still in flight) each independently finish and
  // start their own <audio>, so both play at once — heard as the voice
  // repeating/talking over itself.
  const requestIdRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlaying(false);
  }, []);

  // Returns whether playback actually started — callers that auto-play right
  // after a reply need this to know whether to fall back to a manual "Play"
  // button, rather than silently doing nothing when it fails (e.g. a strict
  // browser autoplay policy, or a synthesis error).
  const play = useCallback(
    async (text: string, voice: string): Promise<boolean> => {
      stop();
      const requestId = requestIdRef.current;
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/speech/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not play audio");
        }
        const blob = await res.blob();
        if (requestId !== requestIdRef.current) return false; // superseded by a newer play() while fetching
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        setLoading(false);
        setPlaying(true);
        await audio.play();
        return true;
      } catch (err) {
        if (requestId !== requestIdRef.current) return false; // superseded — don't report a stale error
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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  return { play, stop, playing, loading, error };
}
