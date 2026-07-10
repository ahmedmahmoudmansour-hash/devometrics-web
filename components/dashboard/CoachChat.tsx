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
import { generateSessionSummary, emailSessionSummary, type SessionSummary } from "@/lib/coach/sessionSummary";
import { createTask } from "@/lib/tasks/actions";

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

function SummaryModal({ summary, onClose }: { summary: SessionSummary; onClose: () => void }) {
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  function sendIt() {
    setEmailState("sending");
    setEmailError(null);
    startTransition(async () => {
      const result = await emailSessionSummary(summary);
      if (result.error) {
        setEmailState("error");
        setEmailError(result.error);
      } else {
        setEmailState("sent");
      }
    });
  }

  function addAsTask(item: string, index: number) {
    startTransition(async () => {
      const result = await createTask({ title: item, recurring: "none" });
      if (!result?.error) setAddedItems((prev) => new Set(prev).add(index));
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,8,16,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--navy-mid)",
          border: "1px solid rgba(0,201,167,0.3)",
          borderRadius: 20,
          padding: 28,
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>Session summary</h2>

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase", marginTop: 16, marginBottom: 6 }}>
          Meeting notes
        </p>
        <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>{summary.meetingNotes}</p>

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--teal)", textTransform: "uppercase", marginTop: 16, marginBottom: 6 }}>
          Action plan
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {summary.actionPlan.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>— {item}</span>
              {addedItems.has(i) ? (
                <span style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700, whiteSpace: "nowrap" }}>✓ Added</span>
              ) : (
                <button
                  type="button"
                  onClick={() => addAsTask(item, i)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  + Add as task
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={sendIt}
            disabled={emailState === "sending" || emailState === "sent"}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              opacity: emailState === "sending" ? 0.6 : 1,
            }}
          >
            {emailState === "sent" ? "✓ Emailed" : emailState === "sending" ? "Sending…" : "✉️ Email me this"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
        {emailError && <p style={{ color: "#f87171", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{emailError}</p>}
      </div>
    </div>
  );
}

// Groups the stored history into per-day "sessions": today's messages stay
// in the live thread, older days collapse into an expandable archive above
// it. Gives "each session stored individually / easy access to previous
// sessions" without a schema change — a calendar day is the session
// boundary, which matches how the coach is actually used (a sit-down
// conversation, not a running group chat).
function partitionByDay(all: CoachMessage[]) {
  const todayKey = new Date().toDateString();
  const today: { role: "user" | "assistant"; content: string }[] = [];
  const past = new Map<string, { role: "user" | "assistant"; content: string }[]>();
  for (const m of all) {
    const key = new Date(m.created_at).toDateString();
    const entry = { role: m.role, content: m.content };
    if (key === todayKey) {
      today.push(entry);
    } else {
      const list = past.get(key) ?? [];
      list.push(entry);
      past.set(key, list);
    }
  }
  return { today, past: [...past.entries()] };
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
  // Computed once from the server-provided history — new messages only ever
  // append to the live thread, so this never needs recomputing.
  const [{ today: initialToday, past: pastSessions }] = useState(() => partitionByDay(initialMessages));
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>(initialToday);
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
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const isSpeechMode = voice !== "off";

  function getSummary() {
    setSummaryLoading(true);
    setError(null);
    startTransition(async () => {
      const result = await generateSessionSummary();
      setSummaryLoading(false);
      if (result.error) setError(result.error);
      else if (result.summary) setSummary(result.summary);
    });
  }
  // Mic input auto-sends the recognized phrase instead of just dropping it
  // in the text box — matches how someone actually wants voice mode to
  // work (speak, done), rather than speak-then-still-have-to-click-Send.
  const {
    listening,
    supported: sttSupported,
    start: startListening,
    stop: stopListening,
    error: micError,
  } = useSpeechInput((transcript) => {
    if (playingRef.current) return; // coach is talking — this is its own voice, not the user
    if (transcript.trim()) send(transcript);
  });

  // Keep the newest message in view whenever one is added (user send AND
  // coach reply) — previously this only fired once per send() in the
  // finally block, which missed the user's own message appearing and made
  // scrolling feel inconsistent.
  const messageCount = messages.length;
  // Also keyed on the last message's length so the view keeps following a
  // reply as it streams in, not just when a whole message is added.
  const lastMessageLength = messages[messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messageCount, lastMessageLength, loading]);

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

  // Switching into Speech mode immediately speaks the coach's latest
  // message — the click is the user gesture browsers need for audio, and
  // silence after picking Speech read as "it doesn't work."
  function handleModeChange(mode: "text" | "speech") {
    if (mode === "text") {
      handleVoiceChange("off");
      return;
    }
    handleVoiceChange(lastNamedVoice);
    const latest = [...messages].reverse().find((m) => m.role === "assistant");
    if (latest) play(latest.content, lastNamedVoice);
  }

  // Picking a different voice replays the coach's latest line in that voice —
  // audible feedback in real content rather than a canned greeting.
  function handleVoiceNameChange(name: string) {
    setLastNamedVoice(name);
    handleVoiceChange(name);
    const latest = [...messages].reverse().find((m) => m.role === "assistant");
    const label = NAMED_VOICES.find((v) => v.value === name)?.label ?? name;
    play(latest ? latest.content : `Hi, this is ${label}.`, name);
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
      if (!res.body) throw new Error("Something went wrong");

      // Streamed reply: an empty assistant bubble appears immediately and
      // fills word-by-word as chunks arrive — same experience as ChatGPT/
      // Claude, instead of a long "Thinking…" then a wall of text.
      const assistantIndex = messages.length + 1;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      setLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        const current = reply;
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIndex] = { role: "assistant", content: current };
          return next;
        });
      }

      // Voice starts once the text is complete — the chunked TTS pipeline
      // then speaks the first sentence while synthesizing the rest.
      if (voice !== "off" && reply) {
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
        {messages.length >= 4 && (
          <button
            type="button"
            onClick={getSummary}
            disabled={summaryLoading}
            style={{
              background: "rgba(0,201,167,0.1)",
              border: "1px solid rgba(0,201,167,0.3)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--teal)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              opacity: summaryLoading ? 0.6 : 1,
            }}
          >
            {summaryLoading ? "Summarizing…" : "📋 Get summary"}
          </button>
        )}
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
        {pastSessions.length > 0 && (
          <details style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
            <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer", listStyle: "none" }}>
              🗂 Previous sessions ({pastSessions.length})
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {pastSessions.map(([day, msgs]) => (
                <details key={day} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
                  <summary style={{ fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                    {new Date(day).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                    <span style={{ color: "var(--text-muted)" }}> · {msgs.length} messages</span>
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    {msgs.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "85%",
                          background: m.role === "user" ? "rgba(0,201,167,0.15)" : "rgba(255,255,255,0.05)",
                          color: "var(--text)",
                          borderRadius: 10,
                          padding: "8px 12px",
                          fontSize: 13,
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {renderInlineMarkdown(m.content)}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        )}
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
        {micError && (
          <div style={{ alignSelf: "flex-start", color: "#f87171", fontSize: 13 }}>
            Mic: {micError}
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
      {summary && <SummaryModal summary={summary} onClose={() => setSummary(null)} />}
    </div>
  );
}
