"use client";

import { useTranslations } from "next-intl";

export default function SkillRadar() {
  const t = useTranslations("skillRadar");

  // Visual demo of the Skill Radar / gap analysis output — current/target
  // are illustrative static numbers, not real data, so only the labels
  // need translation.
  const skills = [
    { label: t("skillLeadership"), current: 65, target: 85 },
    { label: t("skillStrategicThinking"), current: 55, target: 90 },
    { label: t("skillAiFluency"), current: 40, target: 80 },
    { label: t("skillCommunication"), current: 78, target: 85 },
    { label: t("skillProjectMgmt"), current: 72, target: 88 },
    { label: t("skillFinancialLiteracy"), current: 45, target: 75 },
  ];
  const bullets = [t("bullet1"), t("bullet2"), t("bullet3"), t("bullet4")];

  return (
    <section
      style={{
        padding: "100px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 80,
          alignItems: "center",
        }}
        className="flex-col-mobile"
      >
        {/* Left: copy */}
        <div>
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
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              marginTop: 12,
              marginBottom: 20,
              color: "var(--text)",
            }}
          >
            {t("headline1")}
            <br />
            <span className="gradient-text">{t("headline2")}</span>
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32 }}>
            {t("description")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bullets.map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.25" stroke="var(--teal)" strokeWidth="1.5" />
                  <path d="M5 8l2.5 2.5L11 5.5" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: visual bar chart */}
        <div
          style={{
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "32px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("chartTitle")}</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--teal)",
                background: "rgba(0,201,167,0.1)",
                border: "1px solid rgba(0,201,167,0.2)",
                borderRadius: 100,
                padding: "3px 10px",
                fontWeight: 600,
              }}
            >
              {t("liveSample")}
            </span>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(0,201,167,0.35)", display: "block" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("current")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--teal)", display: "block" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("target")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 3, background: "rgba(255,100,100,0.5)", display: "block", borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("gap")}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {skills.map((skill) => {
              const gap = skill.target - skill.current;
              return (
                <div key={skill.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{skill.label}</span>
                    <span className="mono" style={{ fontSize: 12, color: "rgba(255,100,100,0.8)", fontWeight: 600 }}>−{gap}</span>
                  </div>
                  <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 100 }}>
                    {/* Target bar */}
                    <div
                      style={{
                        position: "absolute",
                        insetInlineStart: 0,
                        insetBlockStart: 0,
                        height: "100%",
                        width: `${skill.target}%`,
                        background: "rgba(0,201,167,0.15)",
                        borderRadius: 100,
                      }}
                    />
                    {/* Current bar */}
                    <div
                      style={{
                        position: "absolute",
                        insetInlineStart: 0,
                        insetBlockStart: 0,
                        height: "100%",
                        width: `${skill.current}%`,
                        background: "linear-gradient(90deg, #00C9A7, #0891b2)",
                        borderRadius: 100,
                        transition: "width 1s ease",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{skill.current}/100</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("targetValue", { value: skill.target })}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Career Health Score */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 24,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{t("careerHealthScore")}</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: "var(--teal)" }}>
                62<span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>/100</span>
              </div>
            </div>
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{t("promotionReadiness")}</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--amber)" }}>{t("readyPercent", { percent: 68 })}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .flex-col-mobile { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
