"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { CoachMessage } from "@/lib/supabase/types";
import CoachAvatar from "@/components/CoachAvatar";
import Avatar from "@/components/Avatar";
import Mascot from "@/components/Mascot";
import { updateCoachVoice } from "@/app/dashboard/actions";
import { useVoicePlayback } from "@/lib/speech/useVoicePlayback";
import { useSpeechInput } from "@/lib/roleplay/useSpeech";
import { renderInlineMarkdown } from "@/lib/format/renderInlineMarkdown";

const NAMED_VOICES = [
  { value: "sarah", label: "Sarah" },
  { value: "theo", label: "Theo" },
  { value: "megan", label: "Megan" },
  { value: "jack", label: "Jack" },
];

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--teal)" : "transparent",
    color: active ? "#0A0F1E" : "var(--text-muted)",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default function CoachChat({
  initialMessages,
  userName,
  userAvatarUrl,
  initialVoice,
}: {
  initialMessages: CoachMessage[];
  userName: string;
  userAvatarUrl?: string | null;
  initialVoice: string;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>(
    initialMessages.map((m) => ({ role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState(initialVoice);
  // Remembers the last named voice picked, so switching Text → Speech and
  // back restores the same voice instead of resetting to a default every
  // time — "off" itself is never a valid named voice to fall back to.
  const [lastNamedVoice, setLastNamedVoice] = useState(initialVoice !== "off" ? initialVoice : "sarah");
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const { play, stop: stopSpeaking, playing, loading: voiceLoading, error: voiceError } = useVoicePlayback();
  // The mic stays open in continuous mode, so while the coach's reply is
  // playing out loud the recognizer picks the coach's own voice up off the
  // speakers and auto-sends it back as if the user said it — the "AI
  // interrupts me / talks to itself" bug. Track playing in a ref so the
  // mic callback (a stable closure) can drop anything heard mid-playback.
  const playingRef = useRef(false);
  playingRef.current = playing || voiceLoading;
  // Only messages where autoplay actually failed get a manual fallback
  // button — otherwise it shows on every reply regardless of whether
  // autoplay worked, which makes it look like clicking is always required.
  const [autoplayFailedFor, setAutoplayFailedFor] = useState<Set<number>>(new Set());
  const isSpeechMode = voice !== "off";
  // Mic input auto-sends the recognized phrase instead of just dropping it
  // in the text box — matches how someone actually wants voice mode to
  // work (speak, done), rather than speak-then-still-have-to-click-Send.
  const {
    listening,
    supported: sttSupported,
    start: startListening,
    stop: stopListening,
  } = useSpeechInput((transcript) => {
    if (playingRef.current) return; // coach is talking — this is its own voice, not the user
    if (transcript.trim()) send(transcript);
  });

  // Keep the newest message in view whenever one is added (user send AND
  // coach reply) — previously this only fired once per send() in the
  // finally block, which missed the user's own message appearing and made
  // scrolling feel inconsistent.
  const messageCount = messages.length;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messageCount, loading]);

  function toggleMic() {
    if (listening) stopListening();
    else startListening();
  }

  function handleVoiceChange(next: string) {
    setVoice(next);
    startTransition(() => {
      updateCoachVoice(next);
    });
  }

  function handleModeChange(mode: "text" | "speech") {
    handleVoiceChange(mode === "text" ? "off" : lastNamedVoice);
  }

  // Plays an instant, short confirmation in the newly-picked voice — without
  // this, picking a different name gives no audible feedback until the next
  // reply arrives, which reads as "the voice didn't change" even though it
  // did.
  function handleVoiceNameChange(name: string) {
    setLastNamedVoice(name);
    handleVoiceChange(name);
    const label = NAMED_VOICES.find((v) => v.value === name)?.label ?? name;
    play(`Hi, this is ${label}.`, name);
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }
      const { reply } = await res.json();
      const assistantIndex = messages.length + 1;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (voice !== "off") {
        play(reply, voice).then((ok) => {
          if (!ok) setAutoplayFailedFor((prev) => new Set(prev).add(assistantIndex));
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div
      style={{
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        height: "70vh",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <Link
          href="/dashboard"
          onClick={() => {
            stopSpeaking();
            stopListening();
          }}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textDecoration: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 12px",
            whiteSpace: "nowrap",
          }}
        >
          ✕ End session
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {(playing || voiceLoading) && (
          <button
            type="button"
            onClick={stopSpeaking}
            style={{
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.35)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#f87171",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ■ Stop speaking
          </button>
        )}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
          <button type="button" onClick={() => handleModeChange("text")} style={modeButtonStyle(!isSpeechMode)}>
            💬 Text
          </button>
          <button type="button" onClick={() => handleModeChange("speech")} style={modeButtonStyle(isSpeechMode)}>
            🔊 Speech
          </button>
        </div>
        {isSpeechMode && (
          <select
            aria-label="Coach voice"
            value={voice}
            onChange={(e) => handleVoiceNameChange(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              color: "var(--text)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {NAMED_VOICES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Mascot size={64} />
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 12 }}>
              Ask about your gap, next steps, or how to close a specific competency —
              your coach knows your current plan and progress.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              flexDirection: m.role === "user" ? "row-reverse" : "row",
              maxWidth: "80%",
            }}
          >
            {m.role === "user" ? <Avatar name={userName} avatarUrl={userAvatarUrl} /> : <CoachAvatar />}
            <div
              style={{
                background: m.role === "user" ? "var(--teal)" : "rgba(255,255,255,0.05)",
                color: m.role === "user" ? "#0A0F1E" : "var(--text)",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {renderInlineMarkdown(m.content)}
              {m.role === "assistant" && voice !== "off" && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() =>
                      play(m.content, voice).then((ok) => {
                        if (ok) {
                          setAutoplayFailedFor((prev) => {
                            const next = new Set(prev);
                            next.delete(i);
                            return next;
                          });
                        }
                      })
                    }
                    disabled={voiceLoading || playing}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--teal)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                      opacity: voiceLoading || playing ? 0.6 : 1,
                    }}
                  >
                    {voiceLoading
                      ? "Loading…"
                      : playing
                        ? "Playing…"
                        : `🔊 ${autoplayFailedFor.has(i) ? "Play (autoplay was blocked)" : "Play"}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignSelf: "flex-start" }}>
            <CoachAvatar thinking />
            <div style={{ color: "var(--text-muted)", fontSize: 13, alignSelf: "center" }}>Thinking…</div>
          </div>
        )}
        {error && (
          <div style={{ alignSelf: "flex-start", color: "#f87171", fontSize: 13 }}>{error}</div>
        )}
        {voiceError && (
          <div style={{ alignSelf: "flex-start", color: "#f87171", fontSize: 13 }}>
            Voice: {voiceError}
          </div>
        )}
      </div>

      <form
        onSubmit={sendMessage}
        style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid var(--border)" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Message to your career coach"
          placeholder="Ask your career coach…"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            outline: "none",
          }}
        />
        {sttSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={loading}
            aria-label={listening ? "Stop recording" : "Speak your message"}
            style={{
              background: listening ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.05)",
              border: listening ? "1px solid rgba(248,113,113,0.4)" : "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              cursor: "pointer",
              color: listening ? "#f87171" : "var(--text-muted)",
            }}
          >
            {listening ? "● Listening" : "🎙"}
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
