import CapabilityPyramid from "./CapabilityPyramid";

const pillars = [
  {
    label: "Competency science",
    title: "A structured model, not a checklist",
    description:
      "Devometrics scores you against a defined competency taxonomy — technical, leadership, behavioral, strategic — instead of letting you self-report skills. Scoring is grounded in established competency-science frameworks (Boyatzis' behaviorally-anchored competency model, SHL's Universal Competency Framework, O*NET's occupational taxonomy) rather than free-floating judgment — real, named frameworks, not a fabricated citation to a study that doesn't exist.",
  },
  {
    label: "Labor-market signal",
    title: "The gap moves with the market",
    description:
      "\"Important\" skills change. Target-role scoring is weighted against real job-description and market-demand data, so a gap map reflects what employers are asking for now, not a fixed rubric written once and never revisited.",
  },
  {
    label: "Confidence-scored inference",
    title: "You see what the AI is sure of",
    description:
      "Every extracted competency carries a visible Confidence Score alongside its rating. When the model is inferring from limited signal, that's shown — not hidden behind a single clean-looking number.",
  },
  {
    label: "Continuous recalibration",
    title: "The plan updates as you do",
    description:
      "A gap analysis is a snapshot, not a verdict. As you complete milestones and the role or market shifts, your competency scores and plan are designed to be recalculated — not delivered once and left to go stale.",
  },
  {
    label: "Adult learning design",
    title: "Built for how adults actually learn",
    description:
      "Every recommendation is problem-centered and tied to a real situation you're facing, not abstract theory — and paced on your terms, not a fixed syllabus. We deliberately don't rely on \"learning styles\" (visual/auditory/kinesthetic) — that framework hasn't held up under research scrutiny. Your format preference shapes what keeps you motivated and consistent, not a diagnosis of how you supposedly learn best.",
  },
];

export default function Methodology() {
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
          Methodology
        </span>
        <h2
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginTop: 12,
            color: "var(--text)",
          }}
        >
          A discipline, <span className="gradient-text">not an opinion</span>
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
          Devometrics follows the naming convention of econometrics, psychometrics,
          and biometrics — disciplines that apply rigorous, quantitative measurement
          to a domain. Here&apos;s what that means for how your score is actually built.
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
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {pillar.description}
            </p>
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
          Our capability model
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
          One pyramid, all 8 dimensions
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
          Every competency we score sits on one of three tiers — personal capability is the
          foundation, professional and technical execution builds on it, and organizational
          and leadership impact sits on top. Your own pyramid fills in with color as you complete
          assessments.
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
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.7,
        }}
      >
        All scores are guidance, not a guarantee of career outcomes.
      </p>
    </section>
  );
}
