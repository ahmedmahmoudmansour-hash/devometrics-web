"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitContactInquiry, type InquiryType } from "@/lib/contact/actions";

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "13px 16px",
  fontSize: 15,
  color: "var(--text)",
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
};

function isInquiryType(v: string | null): v is InquiryType {
  return v === "sales" || v === "support" || v === "careers";
}

export default function ContactForm() {
  const t = useTranslations("contact");
  const TYPES: { value: InquiryType; label: string }[] = [
    { value: "sales", label: t("typeSales") },
    { value: "support", label: t("typeSupport") },
    { value: "careers", label: t("typeCareers") },
  ];
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");

  const [type, setType] = useState<InquiryType>(isInquiryType(initialType) ? initialType : "sales");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitContactInquiry({ type, name, email, message, honeypot });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div
        style={{
          background: "rgba(var(--teal-rgb),0.08)",
          border: "1px solid rgba(var(--teal-rgb),0.25)",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{t("sentTitle")}</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          {t("sentBody", { type: TYPES.find((item) => item.value === type)?.label ?? type })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label style={labelStyle}>{t("aboutLabel")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          {TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setType(item.value)}
              style={{
                flex: 1,
                background: type === item.value ? "var(--teal)" : "rgba(255,255,255,0.05)",
                color: type === item.value ? "#0A0F1E" : "var(--text-muted)",
                border: type === item.value ? "none" : "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="contact-name" style={labelStyle}>{t("nameLabel")}</label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="contact-email" style={labelStyle}>{t("emailLabel")}</label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="contact-message" style={labelStyle}>{t("messageLabel")}</label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Honeypot — hidden from real visitors via layout, not display:none
          (bots skip fields they detect as hidden that way). */}
      <div style={{ position: "absolute", insetInlineStart: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
        <label htmlFor="contact-company">{t("companyLabel")}</label>
        <input
          id="contact-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 10,
          padding: "14px 20px",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
