"use client";

import Link from "next/link";
import { ASSESSMENTS } from "@/lib/assessments/catalog";

const features: { title: string; description: string; tag?: string; tagColor?: string; href?: string }[] = [
  {
    title: "AI Discovery Interview",
    description:
      "A short conversational interview that extracts your real capabilities — what you decide, lead, and own — building a richer profile than any checkbox form.",
  },
  {
    title: "Competency Gap Map",
    description:
      "Your skills scored across 8 fixed dimensions with Current Level, Target Level, Gap Size, Market Demand, and a Confidence Score. Not guesses — extracted from your actual documents.",
  },
  {
    title: "Development Roadmaps",
    description:
      "30-day / 90-day / 12-month / 3-year plans drawing from 9 formats — reading, research, courses, certifications, webinars, hands-on work, mentorship, peer learning, live cohorts — matched to your budget and how you actually learn. Free and low-cost options included at every step, not just the expensive ones.",
  },
  {
    title: "AI Career Coach",
    description:
      "Conversational Q&A that remembers your full profile. Ask anything from \"Am I ready for promotion?\" to \"How do I transition into consulting?\" and get grounded, specific answers.",
  },
  {
    title: "Assessment Center",
    description:
      `${ASSESSMENTS.length} assessments across every career level — Leadership, AI Literacy, Emotional Intelligence, Strategic Thinking, and more — each with a scored band, situational case studies, and development actions.`,
  },
  {
    title: "Resume Intelligence",
    description:
      "ATS compatibility audit, keyword gap analysis, achievement quality scoring, and visibility recommendations — all in one pass.",
  },
  {
    title: "Interview & Scenario Simulator",
    description:
      "Live role-play through real workplace situations — difficult feedback, delegation, conflict, restructuring conversations — organized by career level. The AI plays the other person realistically, then gives direct feedback grounded in what you actually said. Text or free browser voice.",
  },
  {
    title: "Career Profile & Momentum",
    description:
      "A LinkedIn-style profile — job history, skills, qualifications, career aspirations — auto-filled from the CV you already uploaded. Your Career Health trend, streaks, and achievements track your progress automatically as you use the platform.",
  },
  {
    title: "Daily Tasks",
    description:
      "Turn any milestone into today's concrete steps with one click of AI. Fully private — never visible to your manager or organization, by design, not just by default.",
  },
  {
    title: "Corporate Platform",
    description:
      "Company workspace with its own admin, workforce skill inventory, a talent heatmap across your team, a leadership-readiness signal, and a custom competency framework mapped onto the scoring engine (with AI-assisted suggestions). Anonymous culture and pulse surveys with AI-drafted questions round out the picture — built on the same competency graph your people already use individually. Each company's data stays fully isolated from every other company.",
    href: "/enterprise",
  },
];

export default function Features() {
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
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--teal)",
              textTransform: "uppercase",
            }}
          >
            Platform features
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
            Everything you need to{" "}
            <span className="gradient-text">close the gap</span>
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
            Everything below is live today.
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
                      paddingRight: 12,
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
                  <p style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600, marginTop: 14 }}>Learn more →</p>
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
