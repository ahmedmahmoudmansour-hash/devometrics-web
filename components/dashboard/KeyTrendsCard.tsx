"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

export default function KeyTrendsCard({ jobTitle }: { jobTitle: string | null }) {
  const [title, setTitle] = useState(jobTitle ?? "");
  const [summary, setSummary] = useState<string | null>(null);
  const [wasCached, setWasCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTrends() {
    if (!title.trim() || loading) return;
    setLoading(true);
    setSearching(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: title.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not fetch trends");
      }
      if (!res.body) throw new Error("Could not fetch trends");

      setWasCached(res.headers.get("X-Trends-Cached") === "true");

      // Streamed: for an uncached job title, Claude has to run 2-4 real web
      // searches before writing anything, so the first chunk can take a
      // few seconds to arrive — but once it starts, the summary appears
      // sentence by sentence instead of everything landing at once.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (text === "") setSearching(false);
        text += decoder.decode(value, { stream: true });
        setSummary(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch trends");
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <TrendingUp size={16} color="var(--teal)" />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Key trends in your field</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Real, web-searched trends for a role you enter below — not a guess from training data.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: summary || error || loading ? 16 : 0 }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Product Manager, Data Analyst…"
          aria-label="Job title to search trends for"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={fetchTrends}
          disabled={loading || !title.trim()}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            opacity: loading || !title.trim() ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Searching…" : "Get trends"}
        </button>
      </div>

      {searching && !summary && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Running a few real web searches — first time for this role can take up to ~15s, instant after that.
        </p>
      )}

      {error && <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p>}
      {summary && (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          {summary}
          {wasCached && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
              ⚡ Served from cache — refreshed weekly, not re-searched on every visit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
