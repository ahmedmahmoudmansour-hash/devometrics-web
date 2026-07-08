"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

export default function KeyTrendsCard({ jobTitle }: { jobTitle: string | null }) {
  const [title, setTitle] = useState(jobTitle ?? "");
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTrends() {
    if (!title.trim() || loading) return;
    setLoading(true);
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
      const { summary: text } = await res.json();
      setSummary(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch trends");
    } finally {
      setLoading(false);
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

      <div style={{ display: "flex", gap: 8, marginBottom: summary || error ? 16 : 0 }}>
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
        </div>
      )}
    </div>
  );
}
