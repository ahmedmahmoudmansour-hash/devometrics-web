"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RoleplayScenario } from "@/lib/roleplay/scenarios";
import type { RoleplaySession } from "@/lib/supabase/types";
import { useSpeechInput, stripStageDirections } from "@/lib/roleplay/useSpeech";
import { useVoicePlayback } from "@/lib/speech/useVoicePlayback";
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

export default function RoleplayChat({
  scenario,
  initialSession,
}: {
  scenario: RoleplayScenario;
  initialSession: RoleplaySession | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>(
    initialSession && initialSession.messages.length > 0
      ? initialSession.messages
      : [{ role: "assistant", content: scenario.openingMessage }]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(initialSession?.completed ?? false);
  const [voice, setVoice] = useState("off");
  const [lastNamedVoice, setLastNamedVoice] = useState("sarah");
  const isSpeechMode = voice !== "off";
  const listRef = useRef<HTMLDivElement>(null);
  // Follows a streaming reply as it grows, not just when a whole message is
  // added.
  const messageCount = messages.length;
  const lastMessageLength = messages[messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messageCount, lastMessageLength, loading]);

  // Switching into Speech mode immediately speaks the character's latest
  // message — the click IS the user gesture browsers require for audio, and
  // "I picked Speech and it still didn't talk" was the exact complaint.
  function handleModeChange(mode: "text" | "speech") {
    if (mode === "text") {
      setVoice("off");
      return;
    }
    setVoice(lastNamedVoice);
    const latest = [...messages].reverse().find((m) => m.role === "assistant");
    if (latest) play(stripStageDirections(latest.content), lastNamedVoice);
  }

  // Picking a different voice replays the character's latest line in that
  // voice — real audible feedback in real content, instead of a canned
  // greeting that tells you nothing about how the scenario will sound.
  function handleVoiceNameChange(name: string) {
    setLastNamedVoice(name);
    setVoice(name);
    const latest = [...messages].reverse().find((m) => m.role === "assistant");
    const label = NAMED_VOICES.find((v) => v.value === name)?.label ?? name;
    play(latest ? stripStageDirections(latest.content) : `Hi, this is ${label}.`, name);
  }

  const { play, playing: speaking, loading: voiceLoading, error: voiceError } = useVoicePlayback();
  // Same fix as CoachChat: with the mic in continuous mode, the recognizer
  // hears the scenario character's own reply coming out of the speakers and
  // auto-sends it back — heard as the AI "interrupting" or talking to
  // itself. Ref (not state) so the stable mic callback sees the live value.
  const speakingRef = useRef(false);
  speakingRef.current = speaking || voiceLoading;
  // Only messages where autoplay actually failed get a manual fallback
  // button — otherwise showing it on every reply makes it look like
  // clicking is always required, even when autoplay already worked.
  const [autoplayFailedFor, setAutoplayFailedFor] = useState<Set<number>>(new Set());
  // Auto-sends the recognized phrase instead of just dropping it in the
  // text box — speaking should be enough on its own, without also having
  // to reach for Send afterward.
  const {
    listening,
    supported: sttSupported,
    start: startListening,
    stop: stopListening,
    error: micError,
  } = useSpeechInput((transcript) => {
    if (speakingRef.current) return; // that's the character's voice, not the user
    if (transcript.trim()) send(transcript, false);
  });

  async function send(text: string, endScenario: boolean) {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioSlug: scenario.slug, sessionId, message: text, endScenario }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }
      if (!res.body) throw new Error("Something went wrong");

      const newSessionId = res.headers.get("X-Session-Id");
      if (newSessionId) setSessionId(newSessionId);

      // Streamed reply — an empty bubble appears immediately and fills as
      // Claude generates it, instead of waiting for the whole in-character
      // reply (which used to be the single biggest source of "delay" here).
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

      if (endScenario) setEnded(true);
      if (voice !== "off" && reply) {
        play(stripStageDirections(reply), voice).then((ok) => {
          if (!ok) setAutoplayFailedFor((prev) => new Set(prev).add(assistantIndex));
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input, false);
  }

  function toggleMic() {
    if (listening) stopListening();
    else startListening();
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
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
            {scenario.title}
          </span>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{scenario.yourRole}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
              value={voice}
              onChange={(e) => handleVoiceNameChange(e.target.value)}
              aria-label="Voice for the other person in this scenario"
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
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              background: m.role === "user" ? "var(--teal)" : "rgba(255,255,255,0.05)",
              color: m.role === "user" ? "#0A0F1E" : "var(--text)",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {renderInlineMarkdown(m.role === "assistant" ? stripStageDirections(m.content) : m.content)}
            {m.role === "assistant" && voice !== "off" && (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    play(stripStageDirections(m.content), voice).then((ok) => {
                      if (ok) {
                        setAutoplayFailedFor((prev) => {
                          const next = new Set(prev);
                          next.delete(i);
                          return next;
                        });
                      }
                    })
                  }
                  disabled={speaking || voiceLoading}
                  style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, opacity: speaking || voiceLoading ? 0.6 : 1 }}
                >
                  {voiceLoading
                    ? "Generating voice…"
                    : `🔊 ${autoplayFailedFor.has(i) ? "Play (autoplay was blocked)" : "Play"}`}
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "var(--text-muted)", fontSize: 13 }}>Thinking…</div>
        )}
        {voiceLoading && (
          <div style={{ alignSelf: "flex-start", color: "var(--teal)", fontSize: 12 }}>Generating voice…</div>
        )}
        {speaking && (
          <div style={{ alignSelf: "flex-start", color: "var(--teal)", fontSize: 12 }}>Speaking…</div>
        )}
        {error && <div style={{ alignSelf: "flex-start", color: "#f87171", fontSize: 13 }}>{error}</div>}
        {voiceError && (
          <div style={{ alignSelf: "flex-start", color: "#f87171", fontSize: 13 }}>Voice: {voiceError}</div>
        )}
        {micError && (
          <div style={{ alignSelf: "flex-start", color: "#f87171", fontSize: 13 }}>Mic: {micError}</div>
        )}
      </div>

      {ended ? (
        <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>Scenario complete — feedback above ↑</span>
          <Link
            href="/dashboard/roleplay"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", textDecoration: "none" }}
          >
            Try another scenario
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid var(--border)" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Your response"
            placeholder="Say what you'd actually say…"
            disabled={loading}
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
              aria-label={listening ? "Stop recording" : "Speak your response"}
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
          <button
            type="button"
            disabled={loading}
            onClick={() => send("I'd like to end the scenario here and get feedback.", true)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            End & get feedback
          </button>
        </form>
      )}
    </div>
  );
}
