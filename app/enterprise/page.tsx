import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PlatformChatWidget from "@/components/PlatformChatWidget";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import Avatar from "@/components/Avatar";
import { levelBg, levelText } from "@/lib/ui/levelColor";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";

export const metadata: Metadata = {
  title: "Devometrics for Enterprise — Workforce Intelligence",
  description:
    "One competency graph for your whole team — workforce skill inventory, talent heatmaps, leadership-readiness signal, and manager-assigned development tasks, built on the same engine every employee already uses individually.",
};

const capabilities: { title: string; description: string }[] = [
  {
    title: "Workforce skill inventory",
    description:
      "Every employee's Career Health Score, assessments completed, and plan progress in one table — scoped strictly to your own organization, never a shared pilot-wide view.",
  },
  {
    title: "Talent heatmap",
    description:
      "All 8 competency dimensions across your whole team at a glance, so you can see where the org is strong and where a whole function is quietly under-skilled.",
  },
  {
    title: "Leadership readiness signal",
    description:
      "A directional ranking by Leadership, Strategic Thinking, and People Management — a real starting conversation for succession planning, not dressed up as a finished one.",
  },
  {
    title: "Team capability pyramid",
    description:
      "The same personal → professional → organizational capability model your employees see individually, averaged across the whole company.",
  },
  {
    title: "Manager-assigned tasks",
    description:
      "Assign a task straight onto an employee's development plan from their profile — it shows up flagged as assigned by their manager, not just self-directed.",
  },
  {
    title: "Custom competency framework",
    description:
      "Name competencies in your own company's language and map each onto the dimension that actually drives scoring — or let AI suggest the mapping. Mapping is optional, since some competencies (pure values statements) don't cleanly fit any dimension.",
  },
  {
    title: "Anonymous culture & pulse surveys",
    description:
      "AI drafts rating, multiple-choice, and open-ended questions on any theme — review and edit before assigning. Results only ever surface as anonymous aggregates once at least 3 people respond; individual answers are never visible to admins, enforced at the database level.",
  },
  {
    title: "Executive assessments",
    description:
      "Organizational Culture Stewardship and Leading Organizational Change — executive-level assessments built for the people actually accountable for those outcomes.",
  },
  {
    title: "Company contacts & branding",
    description:
      "Named platform and finance contacts for your workspace, plus your own logo and accent color applied across every employee's dashboard.",
  },
  {
    title: "Fully isolated per company",
    description:
      "Every query is scoped through row-level security tied to organization membership — your data never mixes with another company's, even on the same platform.",
  },
];

// Fictional workspace used purely to illustrate the shape of the real
// Talent Heatmap + Capability Pyramid — the components below are the exact
// ones every real workspace renders, just fed made-up data instead of a
// live buildCompanyData() query.
const SAMPLE_ROWS: { name: string; title: string; levels: Partial<Record<CompetencyDimension, number>> }[] = [
  {
    name: "Amara Osei",
    title: "Senior Product Manager",
    levels: {
      "Technical Skills": 72,
      Leadership: 58,
      "Strategic Thinking": 65,
      Communication: 80,
      "AI & Digital Skills": 70,
      "Critical Thinking": 75,
      "People Management": 55,
      "Financial Literacy": 48,
    },
  },
  {
    name: "Priya Kapoor",
    title: "Engineering Manager",
    levels: {
      "Technical Skills": 88,
      Leadership: 74,
      "Strategic Thinking": 60,
      Communication: 68,
      "AI & Digital Skills": 82,
      "Critical Thinking": 78,
      "People Management": 70,
      "Financial Literacy": 40,
    },
  },
  {
    name: "Daniel Mensah",
    title: "Product Analyst",
    levels: {
      "Technical Skills": 65,
      Leadership: 35,
      "Strategic Thinking": 50,
      Communication: 60,
      "AI & Digital Skills": 74,
      "Critical Thinking": 68,
      "People Management": 30,
      "Financial Literacy": 55,
    },
  },
];

const SAMPLE_AVERAGES: Partial<Record<CompetencyDimension, number>> = Object.fromEntries(
  COMPETENCY_DIMENSIONS.map((d) => {
    const values = SAMPLE_ROWS.map((r) => r.levels[d]).filter((v): v is number => v !== undefined);
    return [d, Math.round(values.reduce((a, b) => a + b, 0) / values.length)];
  })
);

const sampleCellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
};
const sampleHeadStyle: React.CSSProperties = {
  ...sampleCellStyle,
  color: "var(--text-muted)",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border)",
};

const steps = [
  {
    n: "1",
    title: "Create your workspace",
    description: "Any team member signs up, then sets up a company workspace in under a minute — no sales call required to start.",
  },
  {
    n: "2",
    title: "Invite your team",
    description: "Add employee emails and they're attached automatically the moment they sign up — no shared invite code to manage.",
  },
  {
    n: "3",
    title: "See and support the whole team",
    description: "Watch the workforce inventory and talent heatmap fill in as people run their Gap Analysis, then assign tasks where you see a real gap.",
  },
];

export default function EnterprisePage() {
  return (
    <>
      <Navbar />
      <main>
        <section
          style={{
            minHeight: "70vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "140px 24px 80px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(0,201,167,0.08)",
                border: "1px solid rgba(0,201,167,0.2)",
                borderRadius: 100,
                padding: "6px 16px",
                marginBottom: 32,
                fontSize: 13,
                color: "var(--teal)",
                fontWeight: 600,
              }}
            >
              For teams &amp; organizations
            </span>
            <h1
              style={{
                fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 24,
                color: "var(--text)",
              }}
            >
              One competency graph.{" "}
              <span className="gradient-text">Your whole team.</span>
            </h1>
            <p
              style={{
                fontSize: "clamp(1rem, 2.2vw, 1.2rem)",
                color: "var(--text-muted)",
                lineHeight: 1.7,
                maxWidth: 600,
                margin: "0 auto 40px",
              }}
            >
              Every employee still uses the exact same individual tools — Gap Analysis, Assessment
              Center, AI Coach. This layer just aggregates what they&apos;ve already done into a
              real workforce-intelligence view for you.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/signup"
                style={{
                  background: "var(--teal)",
                  color: "#0A0F1E",
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "14px 28px",
                  borderRadius: 10,
                  letterSpacing: "0.01em",
                }}
              >
                Set up your company workspace →
              </Link>
              <a
                href="#capabilities"
                style={{
                  color: "var(--text)",
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "14px 20px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              >
                See what&apos;s included
              </a>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 24px 100px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                color: "var(--teal)",
                background: "rgba(0,201,167,0.1)",
                border: "1px solid rgba(0,201,167,0.2)",
                borderRadius: 100,
                padding: "4px 12px",
                fontWeight: 700,
              }}
            >
              Sample workspace — not a mockup, the real components
            </span>
          </div>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", maxWidth: 560, margin: "12px auto 40px" }}>
            This is the actual Talent Heatmap and Team Capability Pyramid every workspace gets, filled
            with three fictional people so you can see the shape of it before setting anything up.
          </p>

          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 32 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...sampleHeadStyle, textAlign: "left" }}>Name</th>
                    {COMPETENCY_DIMENSIONS.map((d) => (
                      <th key={d} style={{ ...sampleHeadStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ROWS.map((r) => (
                    <tr key={r.name}>
                      <td style={sampleCellStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={r.name} avatarUrl={null} />
                          <div>
                            <div>{r.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.title}</div>
                          </div>
                        </div>
                      </td>
                      {COMPETENCY_DIMENSIONS.map((d) => (
                        <td key={d} style={{ ...sampleCellStyle, textAlign: "center", background: levelBg(r.levels[d]) }}>
                          {r.levels[d]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...sampleCellStyle, fontWeight: 700, color: "var(--text-muted)" }}>Team average</td>
                    {COMPETENCY_DIMENSIONS.map((d) => (
                      <td key={d} style={{ ...sampleCellStyle, textAlign: "center", fontWeight: 700, color: levelText(SAMPLE_AVERAGES[d]) }}>
                        {SAMPLE_AVERAGES[d]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "flex", justifyContent: "center" }}>
            <CapabilityPyramid dimensionLevels={SAMPLE_AVERAGES} />
          </div>
        </section>

        <section
          id="capabilities"
          style={{
            padding: "80px 24px",
            background: "var(--navy-mid)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "var(--teal)", textTransform: "uppercase" }}>
                What&apos;s included
              </span>
              <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.03em", marginTop: 12, color: "var(--text)" }}>
                Built for the people accountable for the team
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {capabilities.map((c) => (
                <div
                  key={c.title}
                  className="card-hover"
                  style={{ background: "var(--navy)", border: "1px solid var(--border)", borderRadius: 14, padding: 28 }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 10, letterSpacing: "-0.01em" }}>
                    {c.title}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "100px 24px", maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "var(--teal)", textTransform: "uppercase" }}>
              How it works
            </span>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.03em", marginTop: 12, color: "var(--text)" }}>
              No sales call to get started
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {steps.map((s) => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(0,201,167,0.1)",
                    border: "1px solid rgba(0,201,167,0.3)",
                    color: "var(--teal)",
                    fontWeight: 800,
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            padding: "80px 24px 100px",
            textAlign: "center",
            borderTop: "1px solid var(--border)",
          }}
        >
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 16 }}>
            Ready to see your team&apos;s skill graph?
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            Full pricing for teams is on the{" "}
            <Link href="/#pricing" style={{ color: "var(--teal)", textDecoration: "none" }}>
              main pricing page
            </Link>
            . During the pilot phase, workspaces get full access free.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 700,
                padding: "14px 28px",
                borderRadius: 10,
                letterSpacing: "0.01em",
              }}
            >
              Set up your company workspace →
            </Link>
            <a
              href="mailto:sales@devometrics.com?subject=Devometrics%20for%20Enterprise"
              style={{
                color: "var(--text)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                padding: "14px 20px",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              Talk to sales
            </a>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20 }}>
            Prefer email? Sales:{" "}
            <a href="mailto:sales@devometrics.com" style={{ color: "var(--teal)", textDecoration: "none" }}>
              sales@devometrics.com
            </a>{" "}
            · Support:{" "}
            <a href="mailto:support@devometrics.com" style={{ color: "var(--teal)", textDecoration: "none" }}>
              support@devometrics.com
            </a>
          </p>
        </section>
      </main>
      <Footer />
      <PlatformChatWidget />
    </>
  );
}
