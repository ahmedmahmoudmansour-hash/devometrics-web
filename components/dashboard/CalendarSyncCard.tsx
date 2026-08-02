"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getCalendarFeedToken } from "@/lib/tasks/calendarFeed";
import { importCalendarICS } from "@/lib/tasks/icsImportAction";

export default function CalendarSyncCard() {
  const t = useTranslations("calendarSyncCard");
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
    reader.onerror = () => setImportStatus({ error: t("couldNotReadFile") });
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
            {t("title")}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5, maxWidth: 520 }}>
            {t("description")}
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
            {isPending ? t("settingUp") : t("getMyCalendarLink")}
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
              {copied ? t("copied") : t("copyLink")}
            </button>
          </div>
          <ul style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8, marginTop: 10, paddingInlineStart: 18 }}>
            <li>
              <strong style={{ color: "var(--text)" }}>{t("outlookLabel")}</strong> {t("outlookSteps")}
            </li>
            <li>
              <strong style={{ color: "var(--text)" }}>{t("googleLabel")}</strong> {t("googleSteps")}
            </li>
            <li>
              <strong style={{ color: "var(--text)" }}>{t("appleLabel")}</strong> {t("appleSteps")}
            </li>
          </ul>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            {t("privacyNote")}
          </p>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t("importTitle")}</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 10, lineHeight: 1.5, maxWidth: 520 }}>
          {t("importDescription")}
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
          {isImporting ? t("importing") : t("chooseIcsFile")}
        </label>
        {importStatus?.imported !== undefined && (
          <p style={{ fontSize: 12, color: "var(--teal)", marginTop: 8 }}>
            {importStatus.imported === 1 ? t("importedOne") : t("importedMany", { count: importStatus.imported })}
          </p>
        )}
        {importStatus?.error && <p style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{importStatus.error}</p>}
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          {t("exportInstructions")}
        </p>
      </div>
    </div>
  );
}
