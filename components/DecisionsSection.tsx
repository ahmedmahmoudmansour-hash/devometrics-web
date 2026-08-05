"use client";

import { useTranslations } from "next-intl";

// Shared between the individual homepage ("individualDecisions" namespace)
// and the enterprise page ("enterpriseDecisions" namespace) — same section,
// same visual treatment, different questions for each audience. This is
// the landing pages' single biggest positioning fix: everywhere else on
// the page talks about competencies, scores, and features; this section
// is the one place that states outright what those features are actually
// FOR — the decision each one exists to answer.
export default function DecisionsSection({ namespace }: { namespace: string }) {
  const t = useTranslations(namespace);
  const decisions = [t("decision1"), t("decision2"), t("decision3"), t("decision4"), t("decision5"), t("decision6")];

  return (
    <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
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
            maxWidth: 560,
            margin: "16px auto 0",
            lineHeight: 1.7,
          }}
        >
          {t("subtext")}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {decisions.map((d) => (
          <div
            key={d}
            className="card-hover"
            style={{
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "24px 28px",
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "rgba(0,201,167,0.1)",
                border: "1px solid rgba(0,201,167,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M5 8l2.5 2.5L11 5.5" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.5 }}>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
