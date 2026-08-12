"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Mascot from "./Mascot";

export default function Hero() {
  const t = useTranslations("hero");
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    router.push(`/signup?email=${encodeURIComponent(email)}`);
  };

  return (
    <section
      id="hero"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingBlockStart: 120,
        paddingInline: 24,
        paddingBlockEnd: 80,
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Background glow orbs */}
      <div
        style={{
          position: "absolute",
          insetBlockStart: "20%",
          insetInlineStart: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(var(--teal-rgb),0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          insetBlockStart: "40%",
          insetInlineStart: "20%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(var(--teal-rgb),0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          insetBlockStart: "30%",
          insetInlineEnd: "15%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(var(--teal-rgb),0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Grid lines background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)",
        }}
      />

      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
        {/* Mascot */}
        <div className="fade-up fade-up-1" style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <Mascot size={100} className="float" />
        </div>

        {/* Badge */}
        <div
          className="fade-up fade-up-1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(var(--teal-rgb),0.08)",
            border: "1px solid rgba(var(--teal-rgb),0.2)",
            borderRadius: 100,
            paddingInline: 16,
            paddingBlock: 6,
            marginBottom: 32,
          }}
        >
          <span className="teal-dot" style={{ width: 6, height: 6, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600, letterSpacing: "0.04em" }}>
            {t("badge")}
          </span>
        </div>

        {/* Headline */}
        <h1
          className="fade-up fade-up-2 font-display"
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            marginBottom: 24,
            color: "var(--text)",
          }}
        >
          {t("headlinePrefix")}{" "}
          <span className="gradient-text">{t("headlineHighlight")}</span>
        </h1>

        {/* Subheadline */}
        <p
          className="fade-up fade-up-3"
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
            color: "var(--text-muted)",
            lineHeight: 1.7,
            maxWidth: 620,
            margin: "0 auto 48px",
            fontWeight: 400,
          }}
        >
          {t("subheadline")}
        </p>

        {/* Email capture */}
        <div className="fade-up fade-up-4" id="waitlist">
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <input
              type="email"
              required
              aria-label={t("emailAriaLabel")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                paddingInline: 20,
                paddingBlock: 14,
                fontSize: 15,
                color: "var(--text)",
                outline: "none",
                width: 280,
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(var(--teal-rgb),0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <button
              type="submit"
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 10,
                paddingInline: 28,
                paddingBlock: 14,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.01em",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--teal-dim)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(var(--teal-rgb),0.35)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--teal)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {t("submitCta")}
            </button>
          </form>
          <p style={{ marginTop: 14, fontSize: 13, color: "var(--text-muted)" }}>
            {t("noCreditCard")}
          </p>
        </div>

        {/* Social proof numbers */}
        <div
          className="fade-up fade-up-4"
          style={{
            display: "flex",
            gap: 40,
            justifyContent: "center",
            marginTop: 64,
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "8", label: t("statDimensions") },
            { value: "4", label: t("statHorizons") },
            { value: t("statEngineValue"), label: t("statEngine") },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: "var(--teal)" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: "absolute",
          insetBlockEnd: 32,
          insetInlineStart: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: 0.4,
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: "0.1em", color: "var(--text-muted)" }}>{t("scroll")}</span>
        <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
          <rect x="0.75" y="0.75" width="14.5" height="22.5" rx="7.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2" fill="var(--teal)">
            <animate attributeName="cy" from="6" to="14" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    </section>
  );
}
