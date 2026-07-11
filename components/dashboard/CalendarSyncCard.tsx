"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getCalendarFeedToken } from "@/lib/tasks/calendarFeed";
import { importCalendarICS } from "@/lib/tasks/icsImportAction";

export default function CalendarSyncCard() {
  const router = useRouter();
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ imported?: number; error?: string } | null>(null);
  const [isImporting, startImportTransition] = useTransition();

  function enable() {
    setError(null);
    startTransition(async () => {
      const result = await getCalendarFeedToken();
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedUrl(`${window.location.origin}/api/calendar/feed?t=${result.token}`);
    });
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      startImportTransition(async () => {
        const result = await importCalendarICS(text);
        setImportStatus(result);
        if (result.imported) router.refresh();
      });
    };
    reader.onerror = () => setImportStatus({ error: "Could not read that file." });
    reader.readAsText(file);
  }

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — the URL is visible and selectable as fallback.
    }
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            🔄 Sync with Outlook / Google Calendar
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5, maxWidth: 520 }}>
            Subscribe once and your Devometrics tasks and milestone deadlines appear in your own
            calendar automatically — and stay updated as you add more.
          </p>
        </div>
        {!feedUrl && (
          <button
            type="button"
            onClick={enable}
            disabled={isPending}
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Setting up…" : "Get my calendar link"}
          </button>
        )}
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{error}</p>}

      {feedUrl && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code
              style={{
                flex: "1 1 260px",
                fontSize: 11,
                color: "var(--teal)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                overflowX: "auto",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {feedUrl}
            </code>
            <button
              type="button"
              onClick={copy}
              style={{
                background: "rgba(0,201,167,0.1)",
                border: "1px solid rgba(0,201,167,0.3)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--teal)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "✓ Copied" : "Copy link"}
            </button>
          </div>
          <ul style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8, marginTop: 10, paddingLeft: 18 }}>
            <li>
              <strong style={{ color: "var(--text)" }}>Outlook:</strong> Calendar → Add calendar →
              Subscribe from web → paste the link
            </li>
            <li>
              <strong style={{ color: "var(--text)" }}>Google Calendar:</strong> Other calendars → + →
              From URL → paste the link
            </li>
            <li>
              <strong style={{ color: "var(--text)" }}>Apple Calendar:</strong> File → New Calendar
              Subscription → paste the link
            </li>
          </ul>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            Treat this link like a password — anyone with it can see your task titles. Calendar apps
            refresh subscribed feeds on their own schedule (typically every few hours).
          </p>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>⬆ Import from Outlook / Google / Apple</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 10, lineHeight: 1.5, maxWidth: 520 }}>
          Already have events somewhere else? Export a calendar as an .ics file and bring it in as
          tasks — a one-time import, not a live sync.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics,text/calendar"
          onChange={handleImportFile}
          style={{ display: "none" }}
          id="ics-import-input"
        />
        <label
          htmlFor="ics-import-input"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--text)",
            cursor: isImporting ? "default" : "pointer",
            opacity: isImporting ? 0.6 : 1,
          }}
        >
          {isImporting ? "Importing…" : "Choose .ics file"}
        </label>
        {importStatus?.imported !== undefined && (
          <p style={{ fontSize: 12, color: "var(--teal)", marginTop: 8 }}>
            ✓ Imported {importStatus.imported} event{importStatus.imported === 1 ? "" : "s"} as tasks.
          </p>
        )}
        {importStatus?.error && <p style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{importStatus.error}</p>}
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          In Outlook: File → Save Calendar → export as .ics. In Google Calendar: Settings → Import &
          export → Export. In Apple Calendar: File → Export.
        </p>
      </div>
    </div>
  );
}
