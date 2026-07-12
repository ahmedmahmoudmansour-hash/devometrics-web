"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { submitContactInquiry, type InquiryType } from "@/lib/contact/actions";

const TYPES: { value: InquiryType; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "careers", label: "Careers" },
];

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
          background: "rgba(0,201,167,0.08)",
          border: "1px solid rgba(0,201,167,0.25)",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Message sent ✓</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Thanks — we read every {type} message and get back to real ones.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label style={labelStyle}>What&apos;s this about?</label>
        <div style={{ display: "flex", gap: 8 }}>
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              style={{
                flex: 1,
                background: type === t.value ? "var(--teal)" : "rgba(255,255,255,0.05)",
                color: type === t.value ? "#0A0F1E" : "var(--text-muted)",
                border: type === t.value ? "none" : "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="contact-name" style={labelStyle}>Your name</label>
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
        <label htmlFor="contact-email" style={labelStyle}>Email address</label>
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
        <label htmlFor="contact-message" style={labelStyle}>Message</label>
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
      <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error && <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p>}

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
        {isPending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
