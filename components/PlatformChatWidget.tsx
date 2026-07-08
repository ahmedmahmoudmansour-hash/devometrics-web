"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function PlatformChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/platform-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }
      const { reply } = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100 }}>
      {open && (
        <div
          style={{
            width: 340,
            height: 440,
            marginBottom: 12,
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Ask about Devometrics</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Product questions only — for personal career advice, sign up for the AI Coach.
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Ask what Devometrics does, how pricing works, or what the gap analysis actually measures.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.role === "user" ? "var(--teal)" : "rgba(255,255,255,0.05)",
                  color: m.role === "user" ? "#0A0F1E" : "var(--text)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Thinking…</div>}
            {error && <div style={{ fontSize: 12, color: "#f87171" }}>{error}</div>}
          </div>

          <form onSubmit={send} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Ask about Devometrics"
              placeholder="Ask a question…"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--text)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close chat" : "Ask about Devometrics"}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--teal)",
          border: "none",
          boxShadow: "0 8px 24px rgba(0,201,167,0.35)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "auto",
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A0F1E" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0F1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}
