"use client";

// Visual demo of the Skill Radar / gap analysis output
const skills = [
  { label: "Leadership", current: 65, target: 85 },
  { label: "Strategic Thinking", current: 55, target: 90 },
  { label: "AI Fluency", current: 40, target: 80 },
  { label: "Communication", current: 78, target: 85 },
  { label: "Project Mgmt", current: 72, target: 88 },
  { label: "Financial Literacy", current: 45, target: 75 },
];

export default function SkillRadar() {
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
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--teal)",
              textTransform: "uppercase",
            }}
          >
            Gap analysis
          </span>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              marginTop: 12,
              marginBottom: 20,
              color: "var(--text)",
            }}
          >
            See exactly what&apos;s
            <br />
            <span className="gradient-text">holding you back</span>
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32 }}>
            Every competency scored. Every gap quantified. Confidence levels shown so you
            always know when the AI is inferring versus certain. No vague advice —
            just the precise delta between where you are and where you need to be.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "Current level vs. target level per skill",
              "Market demand signal per competency",
              "Confidence score surfaced — not hidden",
              "Priority ranking by impact on your gap",
            ].map((item) => (
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
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Competency Gap Map</span>
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
              Live sample
            </span>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(0,201,167,0.35)", display: "block" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Current</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--teal)", display: "block" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Target</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 3, background: "rgba(255,100,100,0.5)", display: "block", borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Gap</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {skills.map((skill) => {
              const gap = skill.target - skill.current;
              return (
                <div key={skill.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{skill.label}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,100,100,0.8)", fontWeight: 600 }}>−{gap}</span>
                  </div>
                  <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 100 }}>
                    {/* Target bar */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
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
                        left: 0,
                        top: 0,
                        height: "100%",
                        width: `${skill.current}%`,
                        background: "linear-gradient(90deg, #00C9A7, #0891b2)",
                        borderRadius: 100,
                        transition: "width 1s ease",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{skill.current}/100</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Target: {skill.target}</span>
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
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Career Health Score</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--teal)", letterSpacing: "-0.02em" }}>
                62<span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>/100</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Promotion Readiness</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--amber)" }}>68% ready</div>
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
