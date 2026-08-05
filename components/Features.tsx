"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ASSESSMENTS } from "@/lib/assessments/catalog";

export default function Features() {
  const t = useTranslations("features");

  const features: { title: string; description: string; tag?: string; tagColor?: string; href?: string }[] = [
    { title: t("f1Title"), description: t("f1Description") },
    { title: t("f2Title"), description: t("f2Description") },
    { title: t("f3Title"), description: t("f3Description") },
    { title: t("f4Title"), description: t("f4Description") },
    { title: t("f5Title"), description: t("f5Description", { count: ASSESSMENTS.length }) },
    { title: t("f6Title"), description: t("f6Description") },
    { title: t("f7Title"), description: t("f7Description") },
    { title: t("f8Title"), description: t("f8Description") },
    { title: t("f9Title"), description: t("f9Description") },
    { title: t("f10Title"), description: t("f10Description") },
    { title: t("f11Title"), description: t("f11Description") },
    { title: t("f12Title"), description: t("f12Description") },
    { title: t("f13Title"), description: t("f13Description") },
    { title: t("f14Title"), description: t("f14Description"), href: "/enterprise" },
  ];

  return (
    <section
      id="features"
      style={{
        padding: "100px 24px",
        background: "var(--navy-mid)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
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
            {t("headlinePrefix")}{" "}
            <span className="gradient-text">{t("headlineHighlight")}</span>
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--text-muted)",
              marginTop: 16,
              maxWidth: 500,
              margin: "16px auto 0",
              lineHeight: 1.7,
            }}
          >
            {t("subtext")}
          </p>
        </div>

        {/* Feature grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {features.map((f) => {
            const card = (
              <div
                className="card-hover"
                style={{
                  background: "var(--navy)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "28px",
                  height: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--text)",
                      letterSpacing: "-0.01em",
                      flex: 1,
                      paddingInlineEnd: 12,
                    }}
                  >
                    {f.title}
                  </h3>
                  {f.tag && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: f.tagColor,
                        background: `color-mix(in srgb, ${f.tagColor} 15%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${f.tagColor} 30%, transparent)`,
                        borderRadius: 100,
                        padding: "3px 10px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {f.tag}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
                  {f.description}
                </p>
                {f.href && (
                  <p style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600, marginTop: 14 }}>{t("learnMore")}</p>
                )}
              </div>
            );
            return f.href ? (
              <Link key={f.title} href={f.href} style={{ textDecoration: "none", display: "block" }}>
                {card}
              </Link>
            ) : (
              <div key={f.title}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
