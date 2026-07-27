"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import CapabilityPyramid from "./CapabilityPyramid";

function PillarDescription({ text }: { text: string }) {
  const t = useTranslations("methodology");
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          lineHeight: 1.7,
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
        }}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mono"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          marginTop: 8,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--teal)",
          cursor: "pointer",
        }}
      >
        {expanded ? t("readLess") : t("readMore")}
      </button>
    </div>
  );
}

export default function Methodology() {
  const t = useTranslations("methodology");

  const pillars = [
    { label: t("pillar1Label"), title: t("pillar1Title"), description: t("pillar1Description") },
    { label: t("pillar2Label"), title: t("pillar2Title"), description: t("pillar2Description") },
    { label: t("pillar3Label"), title: t("pillar3Title"), description: t("pillar3Description") },
    { label: t("pillar4Label"), title: t("pillar4Title"), description: t("pillar4Description") },
    { label: t("pillar5Label"), title: t("pillar5Title"), description: t("pillar5Description") },
  ];

  return (
    <section
      id="methodology"
      style={{
        padding: "100px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
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
          {t("headlinePrefix")} <span className="gradient-text">{t("headlineHighlight")}</span>
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "var(--text-muted)",
            marginTop: 16,
            maxWidth: 620,
            margin: "16px auto 0",
            lineHeight: 1.7,
          }}
        >
          {t("subtext")}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        {pillars.map((pillar) => (
          <div
            key={pillar.label}
            className="card-hover"
            style={{
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "32px 28px",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "var(--teal)",
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              {pillar.label}
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
              {pillar.title}
            </h3>
            <PillarDescription text={pillar.description} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 64, textAlign: "center" }}>
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--teal)",
            textTransform: "uppercase",
          }}
        >
          {t("capabilityLabel")}
        </span>
        <h3
          style={{
            fontSize: "clamp(1.4rem, 2.5vw, 1.9rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            marginTop: 10,
            marginBottom: 12,
          }}
        >
          {t("capabilityHeadline")}
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            maxWidth: 560,
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          {t("capabilityDescription")}
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CapabilityPyramid compact />
        </div>
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          textAlign: "center",
          marginTop: 40,
          maxWidth: 620,
          marginInlineStart: "auto",
          marginInlineEnd: "auto",
          lineHeight: 1.7,
        }}
      >
        {t("disclaimer")}
      </p>
    </section>
  );
}
