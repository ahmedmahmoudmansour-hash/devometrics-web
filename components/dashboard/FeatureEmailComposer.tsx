"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { sendFeatureEmail, listFeatureEmailHistory } from "@/lib/organizations/featureEmails";
import { type FeatureEmailKey, type FeatureEmailRow } from "@/lib/organizations/featureEmailConstants";

type EmployeeOption = { userId: string; name: string; email: string; department: string | null };

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  display: "block",
};

export default function FeatureEmailComposer({
  organizationId,
  featureKey,
  employees,
  initialHistory,
}: {
  organizationId: string;
  featureKey: FeatureEmailKey;
  employees: EmployeeOption[];
  initialHistory: FeatureEmailRow[];
}) {
  const t = useTranslations("featureEmailComposer");
  const [openComposer, setOpenComposer] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipientMode, setRecipientMode] = useState<"all" | "department" | "individual">("all");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [isPending, startTransition] = useTransition();

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department).filter((d): d is string => !!d))).sort(), [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
  }, [employees, search]);

  const recipientIds = useMemo(() => {
    if (recipientMode === "all") return employees.map((e) => e.userId);
    if (recipientMode === "department") return employees.filter((e) => e.department && selectedDepartments.includes(e.department)).map((e) => e.userId);
    return selectedUserIds;
  }, [recipientMode, employees, selectedDepartments, selectedUserIds]);

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }
  function toggleDepartment(dept: string) {
    setSelectedDepartments((prev) => (prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]));
  }

  function send() {
    setError(null);
    setConfirmation(null);
    if (recipientIds.length === 0) {
      setError(t("noRecipientsError"));
      return;
    }
    if (scheduleMode === "later" && !scheduledAt) {
      setError(t("pickTimeError"));
      return;
    }
    startTransition(async () => {
      const result = await sendFeatureEmail(
        organizationId,
        featureKey,
        subject,
        message,
        recipientIds,
        scheduleMode === "later" ? new Date(scheduledAt).toISOString() : null
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setConfirmation(result.scheduled ? t("scheduledConfirmation", { count: recipientIds.length }) : t("sentConfirmation", { count: recipientIds.length }));
      setSubject("");
      setMessage("");
      setSelectedUserIds([]);
      setSelectedDepartments([]);
      setScheduleMode("now");
      setScheduledAt("");
      setShowPreview(false);
      listFeatureEmailHistory(organizationId, featureKey).then(setHistory);
    });
  }

  if (!openComposer) {
    return (
      <button
        type="button"
        onClick={() => setOpenComposer(true)}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        {t("openButton")}
      </button>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t("title")}</h2>
        <button type="button" onClick={() => setOpenComposer(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
          {t("close")}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
        <div>
          <label style={labelStyle}>{t("subjectLabel")}</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t("messageLabel")}</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div>
          <label style={labelStyle}>{t("recipientsLabel")}</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["all", "department", "individual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRecipientMode(mode)}
                style={{
                  background: recipientMode === mode ? "var(--teal)" : "rgba(255,255,255,0.05)",
                  color: recipientMode === mode ? "#0A0F1E" : "var(--text)",
                  border: "1px solid " + (recipientMode === mode ? "var(--teal)" : "var(--border)"),
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t(`recipientMode_${mode}`)}
              </button>
            ))}
          </div>

          {recipientMode === "department" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {departments.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("noDepartments")}</p>
              ) : (
                departments.map((d) => (
                  <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedDepartments.includes(d)} onChange={() => toggleDepartment(d)} />
                    {d}
                  </label>
                ))
              )}
            </div>
          )}

          {recipientMode === "individual" && (
            <div>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} style={{ ...inputStyle, marginBottom: 8 }} />
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
                {filteredEmployees.map((e) => (
                  <label key={e.userId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", padding: "4px 2px", cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedUserIds.includes(e.userId)} onChange={() => toggleUser(e.userId)} />
                    {e.name} <span style={{ color: "var(--text-muted)" }}>({e.email})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("recipientCount", { count: recipientIds.length })}</p>
        </div>

        <div>
          <label style={labelStyle}>{t("scheduleLabel")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setScheduleMode("now")}
              style={{
                background: scheduleMode === "now" ? "var(--teal)" : "rgba(255,255,255,0.05)",
                color: scheduleMode === "now" ? "#0A0F1E" : "var(--text)",
                border: "1px solid " + (scheduleMode === "now" ? "var(--teal)" : "var(--border)"),
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("sendNow")}
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode("later")}
              style={{
                background: scheduleMode === "later" ? "var(--teal)" : "rgba(255,255,255,0.05)",
                color: scheduleMode === "later" ? "#0A0F1E" : "var(--text)",
                border: "1px solid " + (scheduleMode === "later" ? "var(--teal)" : "var(--border)"),
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("scheduleForLater")}
            </button>
            {scheduleMode === "later" && (
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={{ ...inputStyle, width: "auto", colorScheme: "dark" }} />
            )}
          </div>
        </div>

        <div>
          <button type="button" onClick={() => setShowPreview((v) => !v)} style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
            {showPreview ? t("hidePreview") : t("showPreview")}
          </button>
          {showPreview && (
            <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{t("previewSubjectLabel")}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>{subject || t("previewEmptySubject")}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{t("previewBodyLabel")}</p>
              {message.trim() ? (
                message
                  .trim()
                  .split(/\n{2,}/)
                  .map((p, i) => (
                    <p key={i} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, marginBottom: 10 }}>
                      {p}
                    </p>
                  ))
              ) : (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("previewEmptyBody")}</p>
              )}
            </div>
          )}
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        {confirmation && <p style={{ color: "var(--teal)", fontSize: 13 }}>{confirmation}</p>}

        <div>
          <button
            type="button"
            onClick={send}
            disabled={isPending}
            style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? t("sending") : scheduleMode === "later" ? t("scheduleButton") : t("sendButton")}
          </button>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            {showHistory ? t("hideHistory") : t("showHistory", { count: history.length })}
          </button>
          {showHistory && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {history.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("noHistory")}</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} style={{ fontSize: 12, color: "var(--text-muted)", borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
                    <div style={{ color: "var(--text)", fontWeight: 600 }}>{h.subject}</div>
                    <div>
                      {h.sentAt
                        ? t("historySent", { date: new Date(h.sentAt).toLocaleString(), count: h.recipientCount, failed: h.failedCount ?? 0 })
                        : t("historyScheduled", { date: new Date(h.sendAt).toLocaleString(), count: h.recipientCount })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
