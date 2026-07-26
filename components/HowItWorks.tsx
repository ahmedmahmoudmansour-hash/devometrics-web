"use client";

import { useTranslations } from "next-intl";

const icons = [
  <svg key="1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>,
  <svg key="2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>,
  <svg key="3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>,
  <svg key="4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>,
];

export default function HowItWorks() {
  const t = useTranslations("howItWorks");
  const steps = [
    { number: "01", title: t("step1Title"), description: t("step1Description"), icon: icons[0] },
    { number: "02", title: t("step2Title"), description: t("step2Description"), icon: icons[1] },
    { number: "03", title: t("step3Title"), description: t("step3Description"), icon: icons[2] },
    { number: "04", title: t("step4Title"), description: t("step4Description"), icon: icons[3] },
  ];

  return (
    <section
      id="how-it-works"
      style={{
        padding: "100px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Section label */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--teal)",
            textTransform: "uppercase",
          }}
        >
          {t("label")}
        </span>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginTop: 12,
            color: "var(--text)",
          }}
        >
          {t("headline1")}
          <br />
          <span className="gradient-text">{t("headline2")}</span>
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "var(--text-muted)",
            marginTop: 16,
            maxWidth: 480,
            margin: "16px auto 0",
            lineHeight: 1.7,
          }}
        >
          {t("subtext")}
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2 }}>
        {steps.map((step, i) => (
          <div
            key={step.number}
            className="card-hover"
            style={{
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: i === 0 ? "16px 0 0 16px" : i === steps.length - 1 ? "0 16px 16px 0" : 0,
              padding: "40px 32px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Step number background */}
            <div
              style={{
                position: "absolute",
                insetBlockStart: -10,
                insetInlineEnd: 16,
                fontSize: 72,
                fontWeight: 900,
                color: "rgba(255,255,255,0.03)",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              {step.number}
            </div>

            {/* Icon */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(0,201,167,0.1)",
                border: "1px solid rgba(0,201,167,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--teal)",
                marginBottom: 20,
              }}
            >
              {step.icon}
            </div>

            {/* Step label */}
            <div
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "var(--teal)",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              {t("stepLabel", { number: step.number })}
            </div>

            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 12,
                letterSpacing: "-0.01em",
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                lineHeight: 1.7,
              }}
            >
              {step.description}
            </p>

            {/* Connector arrow */}
            {i < steps.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  insetInlineEnd: -12,
                  insetBlockStart: "50%",
                  transform: "translateY(-50%)",
                  width: 24,
                  height: 24,
                  background: "var(--teal)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 2l4 3-4 3" stroke="#0A0F1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
