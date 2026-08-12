"use client";

import { useState, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function PlatformChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defers showing the bubble while the marketing homepage's hero (#hero)
  // is in view — on mobile, the hero's own content (mascot, headline,
  // subheadline, CTA, caption) overflows one screen height, so this
  // fixed bottom-right bubble was overlapping the hero's last line of copy
  // (confirmed via direct measurement: chat button 736-788px vs caption
  // 760-780px on a 375x812 viewport). Padding on the hero couldn't fix
  // this — that content comes before any trailing padding in document
  // flow — so instead the bubble just stays out of the way until the
  // visitor scrolls past the hero. Pages without a #hero (every other
  // route) are unaffected — the ref never finds a target, so `hidden`
  // never flips true.
  const [hiddenForHero, setHiddenForHero] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    // No manual initial setState here — IntersectionObserver fires its
    // callback once immediately upon observe() with the current
    // intersection state, which is enough to set hiddenForHero correctly
    // without a synchronous setState in the effect body.
    const observer = new IntersectionObserver(([entry]) => setHiddenForHero(entry.isIntersecting), { threshold: 0 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  if (hiddenForHero) return null;

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
            marginBottom: 10,
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <div className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--teal)" }}>
              Ask Devometrics
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
              Product questions only — for personal career advice, use the AI Coach.
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Ask what Devometrics does, how pricing works, or what the gap analysis actually measures.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ maxWidth: "88%", alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" && (
                  <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>
                    Devometrics
                  </div>
                )}
                <div
                  style={{
                    background: m.role === "user" ? "var(--teal)" : "transparent",
                    color: m.role === "user" ? "#0A0F1E" : "var(--text)",
                    borderInlineStart: m.role === "assistant" ? "2px solid var(--border)" : "none",
                    borderRadius: 2,
                    padding: m.role === "user" ? "8px 12px" : "0 0 0 10px",
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Thinking…</div>}
            {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
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
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--border)",
                borderRadius: 0,
                padding: "8px 2px",
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
                borderRadius: 2,
                padding: "8px 14px",
                fontSize: 12.5,
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
        aria-label={open ? "Close chat" : "Ask Devometrics"}
        className="mono"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginLeft: "auto",
          background: "var(--navy-mid)",
          border: "1px solid var(--border)",
          borderRadius: 2,
          padding: "9px 14px",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text)",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)", flexShrink: 0 }} />
        {open ? "Close" : "Ask Devometrics"}
      </button>
    </div>
  );
}
