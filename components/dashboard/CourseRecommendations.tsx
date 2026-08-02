"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function CourseRecommendations({ topic }: { topic: string }) {
  const t = useTranslations("courseRecommendations");
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !summary && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || t("fetchError"));
        }
        const { summary: text } = await res.json();
        setSummary(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("fetchError"));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
      >
        {open ? t("hideCourses") : t("findCourses")}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {loading && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("searching")}</p>}
          {error && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}
          {summary && (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--text)",
                whiteSpace: "pre-wrap",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
