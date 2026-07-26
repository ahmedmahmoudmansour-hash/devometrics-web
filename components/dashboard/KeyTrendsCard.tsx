"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

export default function KeyTrendsCard({ jobTitle }: { jobTitle: string | null }) {
  const t = useTranslations("keyTrendsCard");
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
        throw new Error(body.error || t("errorFallback"));
      }
      if (!res.body) throw new Error(t("errorFallback"));

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
      setError(err instanceof Error ? err.message : t("errorFallback"));
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <TrendingUp size={16} color="var(--teal)" />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("title")}</h2>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        {t("subtitle")}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: summary || error || loading ? 16 : 0 }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("ariaLabel")}
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
          {loading ? t("searching") : t("getTrends")}
        </button>
      </div>

      {searching && !summary && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("searchingNote")}
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
              {t("cachedNote")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
