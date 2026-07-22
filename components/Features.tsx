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
      "Conversational coaching — voice or text — that remembers your full profile and past sessions. Ask anything from \"Am I ready for promotion?\" to \"How do I transition into consulting?\", then get meeting notes and a concrete action plan from every session, with one-click follow-through into your task list.",
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
    title: "Career Paths Map",
    description:
      "An AI-generated map of where you can realistically go from here — leadership, deep-expertise, and cross-functional branches, each role with your readiness percentage today, the skills it requires, your specific gaps, and an honest time-to-readiness. Grounded in your own gap analysis, not generic career ladders.",
    tag: "New",
    tagColor: "var(--teal)",
  },
  {
    title: "Career GPS",
    description:
      "A “you are here” view of your current destination role — Promotion Readiness and Interview Readiness scored from your real measured competencies, the fastest route to close your biggest gap, and a “what if?” simulator that recalculates your readiness instantly if you change your target or improve a skill.",
    tag: "New",
    tagColor: "var(--teal)",
  },
  {
    title: "Certifications & Credentials",
    description:
      "Track every certification and credential in one place, with expiry reminders so nothing lapses quietly.",
    tag: "New",
    tagColor: "var(--teal)",
  },
  {
    title: "Accountability Groups",
    description:
      "Small peer groups that keep momentum going — check in on each other's goals without needing a manager or coach in the loop.",
    tag: "New",
    tagColor: "var(--teal)",
  },
  {
    title: "Career Profile & Momentum",
    description:
      "A LinkedIn-style profile — job history, skills, qualifications, career aspirations — auto-filled from the CV you already uploaded. Your Career Health trend, streaks, and achievements track your progress automatically as you use the platform.",
  },
  {
    title: "Tasks, Calendar & Workspace",
    description:
      "Turn any milestone into today's concrete steps with one click of AI, plan your week on a built-in calendar, and subscribe once to see it all inside your own Outlook, Google, or Apple calendar. A private AI Workspace turns your rough notes into summaries and action items. Fully private — never visible to your manager or organization, by design, not just by default.",
    tag: "New",
    tagColor: "var(--teal)",
  },
  {
    title: "Corporate Platform",
    description:
      "Company workspace with its own admin, full employee records (employee ID, title, department, business unit, manager, location — editable, archivable, exportable to Excel), a real org chart, a workforce skill inventory, a talent heatmap, and a custom competency framework mapped onto the scoring engine. Impact Cycles bring appraisals built on real global standards — past goals, KPI-linked focus areas, competency ratings, development needs, and dual sign-off — with a manager-only view scoped to just their own direct reports. Each company's data stays fully isolated from every other company.",
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
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "var(--teal)",
              textTransform: "uppercase",
            }}
          >
            Platform features
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
