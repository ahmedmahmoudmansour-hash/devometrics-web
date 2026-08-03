"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateOrganizationEmailMessage } from "@/lib/organizations/emailMessages";
import { EMAIL_MESSAGE_TYPES, type EmailMessageOverride, type EmailMessageType } from "@/lib/organizations/emailMessageTypes";

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
  fontSize: 12,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 6,
};

const EMPTY: EmailMessageOverride = { subject: "", message: "" };

export default function EmailMessagesForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: Partial<Record<EmailMessageType, EmailMessageOverride>>;
}) {
  const t = useTranslations("emailMessagesForm");
  const [activeType, setActiveType] = useState<EmailMessageType>(EMAIL_MESSAGE_TYPES[0]);
  const [values, setValues] = useState<Record<EmailMessageType, EmailMessageOverride>>(() => {
    const initialValues = {} as Record<EmailMessageType, EmailMessageOverride>;
    for (const type of EMAIL_MESSAGE_TYPES) initialValues[type] = initial[type] ?? EMPTY;
    return initialValues;
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<EmailMessageType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = values[activeType];
  const isCustomized = Boolean(active.subject.trim() || active.message.trim());

  function updateActive(fields: Partial<EmailMessageOverride>) {
    setValues((prev) => ({ ...prev, [activeType]: { ...prev[activeType], ...fields } }));
    setSaved(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const typeAtSubmit = activeType;
    startTransition(async () => {
      const result = await updateOrganizationEmailMessage(organizationId, typeAtSubmit, values[typeAtSubmit]);
      if (result?.error) setError(result.error);
      else setSaved(typeAtSubmit);
    });
  }

  function resetToDefault() {
    updateActive({ subject: "", message: "" });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t("title")}</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>{t("description")}</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {EMAIL_MESSAGE_TYPES.map((type) => {
          const customized = Boolean(values[type].subject.trim() || values[type].message.trim());
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setActiveType(type);
                setSaved(null);
                setError(null);
              }}
              style={{
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                border: type === activeType ? "1px solid var(--teal)" : "1px solid var(--border)",
                background: type === activeType ? "rgba(0,201,167,0.1)" : "transparent",
                color: type === activeType ? "var(--teal)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t(`type_${type}`)}
              {customized && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--teal)" }} />}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>{t(`hint_${activeType}`)}</p>

        <div>
          <label style={labelStyle}>{t("subjectLabel")}</label>
          <input
            type="text"
            value={active.subject}
            onChange={(e) => updateActive({ subject: e.target.value })}
            placeholder={t("subjectPlaceholder")}
            maxLength={150}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>{t("messageLabel")}</label>
          <textarea
            value={active.message}
            onChange={(e) => updateActive({ message: e.target.value })}
            placeholder={t("messagePlaceholder")}
            maxLength={1000}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{t("messageScopeNote")}</p>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: saved === activeType ? "rgba(0,201,167,0.1)" : "var(--teal)",
              color: saved === activeType ? "var(--teal)" : "#0A0F1E",
              border: saved === activeType ? "1px solid rgba(0,201,167,0.3)" : "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {saved === activeType ? t("saved") : t("save")}
          </button>
          {isCustomized && (
            <button
              type="button"
              onClick={resetToDefault}
              disabled={isPending}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}
            >
              {t("useDefault")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
