"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  sendAnnouncementTestEmail,
  sendAnnouncementToAllUsers,
  sendAnnouncementToSelectedUsers,
  countAnnouncementRecipients,
  listAnnouncementRecipients,
  type AnnouncementRecipient,
} from "@/lib/admin/broadcast";

const DEFAULT_SUBJECT = "New features are live — try them and tell us what you think (by Sat, Aug 8)";
const DEFAULT_MESSAGE = `We've shipped a batch of updates to Devometrics and would love your eyes on them before we lock in what's next.

What's new:
- Assessment assignments now email you immediately — with a due date, if one's set, that shows up right on your calendar alongside your goals.
- Bulk assignment for admins — assign one assessment or goal to a whole group at once, with one email per person, not a group blast.
- Scoped performance review cycles — admins can now run a cycle for a single employee (e.g. a probation review) instead of it defaulting to the whole company.
- Faster dashboards — the Workforce Analytics and Employees pages load noticeably quicker, especially for larger teams.
- A cleaner navigation — the company admin section is now grouped by what you're actually trying to do, instead of one long row of tabs.

Log in, try what's relevant to your role, and reply to this email with anything that felt off, confusing, or great by Saturday, August 8 — real feedback now shapes what we prioritize next.`;

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};

type Audience = "all" | "selected";

export default function PlatformAnnouncementForm() {
  const t = useTranslations("platformAnnouncementForm");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [ctaUrl, setCtaUrl] = useState("https://devometrics.com/dashboard");
  const [ctaLabel, setCtaLabel] = useState("Open Devometrics");
  const [audience, setAudience] = useState<Audience>("all");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<AnnouncementRecipient[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [testSent, setTestSent] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded && recipientCount === null) {
      countAnnouncementRecipients().then(setRecipientCount);
    }
  }, [expanded, recipientCount]);

  useEffect(() => {
    if (audience === "selected" && recipients === null) {
      listAnnouncementRecipients().then(setRecipients);
    }
  }, [audience, recipients]);

  const filteredRecipients = useMemo(() => {
    if (!recipients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [recipients, search]);

  const targetCount = audience === "all" ? recipientCount ?? 0 : selectedIds.size;
  const confirmMatches = confirmText.trim().toUpperCase() === "SEND";
  const canSend = confirmMatches && targetCount > 0;

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTest() {
    setError(null);
    startTransition(async () => {
      const res = await sendAnnouncementTestEmail(subject, message, ctaUrl, ctaLabel);
      if ("error" in res) setError(res.error);
      else setTestSent(true);
    });
  }

  function handleSend() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res =
        audience === "all"
          ? await sendAnnouncementToAllUsers(subject, message, ctaUrl, ctaLabel)
          : await sendAnnouncementToSelectedUsers([...selectedIds], subject, message, ctaUrl, ctaLabel);
      if ("error" in res) setError(res.error);
      else {
        setResult({ sent: res.sent, failed: res.failed });
        setConfirmText("");
      }
    });
  }

  if (!expanded) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            background: "rgba(0,201,167,0.1)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--teal)",
            cursor: "pointer",
          }}
        >
          {t("openButton")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</h2>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>{t("description")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{t("subjectLabel")}</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{t("messageLabel")}</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={12} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{t("ctaUrlLabel")}</label>
            <input type="text" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{t("ctaLabelLabel")}</label>
            <input type="text" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={isPending || !subject.trim() || !message.trim()}
              onClick={handleTest}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                cursor: "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? t("sending") : t("sendTestButton")}
            </button>
            {testSent && <span style={{ fontSize: 12.5, color: "var(--teal)" }}>{t("testSentConfirmation")}</span>}
          </div>

          {/* Audience toggle */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["all", "selected"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAudience(mode)}
                style={{
                  background: audience === mode ? "var(--teal)" : "rgba(255,255,255,0.05)",
                  border: "1px solid " + (audience === mode ? "var(--teal)" : "var(--border)"),
                  borderRadius: 100,
                  padding: "6px 16px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: audience === mode ? "#0A0F1E" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                {mode === "all" ? t("audienceAll") : t("audienceSelected")}
              </button>
            ))}
          </div>

          {audience === "all" ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {recipientCount === null ? t("loadingCount") : t("recipientCount", { count: recipientCount })}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                style={inputStyle}
              />
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
                {recipients === null ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: 8 }}>{t("loadingRecipients")}</p>
                ) : filteredRecipients.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: 8 }}>{t("noMatchingRecipients")}</p>
                ) : (
                  filteredRecipients.map((r) => (
                    <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleRecipient(r.id)} />
                      <span>{r.name}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{r.email}</span>
                    </label>
                  ))
                )}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t("recipientCount", { count: selectedIds.size })}</p>
            </div>
          )}

          <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{t("confirmInstructions")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SEND"
                aria-label={t("confirmAria")}
                style={{ ...inputStyle, width: 220 }}
              />
              <button
                type="button"
                disabled={isPending || !canSend}
                onClick={handleSend}
                style={{
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.4)",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#f87171",
                  cursor: canSend ? "pointer" : "not-allowed",
                  opacity: isPending || !canSend ? 0.5 : 1,
                }}
              >
                {isPending ? t("sending") : t("sendButton", { count: targetCount })}
              </button>
            </div>
          </div>

          {result && (
            <p style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>
              {t("sendResult", { sent: result.sent, failed: result.failed })}
            </p>
          )}
          {error && <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
