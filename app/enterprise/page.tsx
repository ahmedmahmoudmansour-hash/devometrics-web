import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PlatformChatWidget from "@/components/PlatformChatWidget";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import Avatar from "@/components/Avatar";
import Reveal from "@/components/Reveal";
import DecisionsSection from "@/components/DecisionsSection";
import Methodology from "@/components/Methodology";
import SectionTabs from "@/components/SectionTabs";
import { levelBg, levelText } from "@/lib/ui/levelColor";
import { COMPETENCY_DIMENSIONS, dimensionLabel, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import {
  LayoutList,
  Grid3x3,
  TrendingUp,
  Triangle,
  Network,
  Star,
  ClipboardList,
  SlidersHorizontal,
  MessageSquare,
  Award,
  Palette,
  ShieldCheck,
  ClipboardCheck,
  GitBranch,
  IdCard,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Devometrics for Enterprise — Workforce Intelligence",
  description:
    "One competency graph for your whole team — workforce skill inventory, talent heatmaps, standards-based Impact Cycle appraisals, and manager-assigned development tasks, built on the same engine every employee already uses individually.",
};

const CAPABILITY_ICONS: React.ComponentType<{ size?: number }>[] = [
  Network,
  GitBranch,
  ClipboardCheck,
  IdCard,
  LayoutList,
  Grid3x3,
  Star,
  TrendingUp,
  Triangle,
  ClipboardList,
  SlidersHorizontal,
  MessageSquare,
  Award,
  Palette,
  ShieldCheck,
];

// Fictional workspace used purely to illustrate the shape of the real
// Talent Heatmap + Capability Pyramid — the components below are the exact
// ones every real workspace renders, just fed made-up data instead of a
// live buildCompanyData() query.
const SAMPLE_ROWS_LEVELS: { name: string; levels: Partial<Record<CompetencyDimension, number>> }[] = [
  {
    name: "Amara Osei",
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
    const values = SAMPLE_ROWS_LEVELS.map((r) => r.levels[d]).filter((v): v is number => v !== undefined);
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

export default async function EnterprisePage() {
  const t = await getTranslations("enterprisePage");
  const tCommon = await getTranslations("common");
  const tDim = await getTranslations("competencyDimensions");

  const capabilityTitles = [t("cap1Title"), t("cap2Title"), t("cap3Title"), t("cap4Title"), t("cap5Title"), t("cap6Title"), t("cap7Title"), t("cap8Title"), t("cap9Title"), t("cap10Title"), t("cap11Title"), t("cap12Title"), t("cap13Title"), t("cap14Title"), t("cap15Title")];
  const capabilityDescriptions = [t("cap1Description"), t("cap2Description"), t("cap3Description"), t("cap4Description"), t("cap5Description"), t("cap6Description"), t("cap7Description"), t("cap8Description"), t("cap9Description"), t("cap10Description"), t("cap11Description"), t("cap12Description"), t("cap13Description"), t("cap14Description"), t("cap15Description")];
  const capabilities = CAPABILITY_ICONS.map((icon, i) => ({
    title: capabilityTitles[i],
    description: capabilityDescriptions[i],
    icon,
  }));

  const sampleTitles = [t("sampleTitle1"), t("sampleTitle2"), t("sampleTitle3")];
  const sampleRows = SAMPLE_ROWS_LEVELS.map((r, i) => ({
    ...r,
    title: sampleTitles[i],
  }));

  const steps = [
    { n: "1", title: t("step1Title"), description: t("step1Description") },
    { n: "2", title: t("step2Title"), description: t("step2Description") },
    { n: "3", title: t("step3Title"), description: t("step3Description") },
  ];

  // Tabbed instead of one long scroll — same treatment as the individual
  // homepage, same reasoning: a long sales page loses readers exactly like
  // a long product tour does. Order mirrors the previous scroll order
  // exactly, so nothing's reprioritized, just reachable directly instead of
  // scrolled past. Labels reuse the "common" namespace (decisions,
  // methodology, howItWorks) where the concept is literally the same one
  // the homepage tabs already use, so the two pages read as one system.
  const tabs = [
    {
      key: "decisions",
      label: tCommon("decisions"),
      content: <DecisionsSection namespace="enterpriseDecisions" id="decisions" />,
    },
    {
      key: "methodology",
      label: tCommon("methodology"),
      content: <Methodology />,
    },
    {
      key: "workspace",
      label: tCommon("liveDemo"),
      content: (
        <section id="workspace" style={{ padding: "0 24px 100px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span
              style={{
                fontSize: 11,
                color: "var(--teal)",
                background: "rgba(var(--teal-rgb),0.1)",
                border: "1px solid rgba(var(--teal-rgb),0.2)",
                borderRadius: 100,
                padding: "4px 12px",
                fontWeight: 700,
              }}
            >
              {t("sampleBadge")}
            </span>
          </div>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", maxWidth: 560, margin: "12px auto 40px" }}>
            {t("sampleSubtext")}
          </p>

          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 32 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...sampleHeadStyle, textAlign: "start" }}>{t("tableNameHeader")}</th>
                    {COMPETENCY_DIMENSIONS.map((d) => (
                      <th key={d} style={{ ...sampleHeadStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                        {dimensionLabel(tDim, d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((r) => (
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
                        <td key={d} className="mono" style={{ ...sampleCellStyle, textAlign: "center", background: levelBg(r.levels[d]) }}>
                          {r.levels[d]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...sampleCellStyle, fontWeight: 700, color: "var(--text-muted)" }}>{t("teamAverage")}</td>
                    {COMPETENCY_DIMENSIONS.map((d) => (
                      <td key={d} className="mono" style={{ ...sampleCellStyle, textAlign: "center", fontWeight: 700, color: levelText(SAMPLE_AVERAGES[d]) }}>
                        {SAMPLE_AVERAGES[d]}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Turns the raw score table into the actual point of it: not
              "here are some numbers" but "here's the decision this
              surfaces" — the exact gap between a competency graph and a
              decision engine. */}
          <div
            style={{
              background: "rgba(var(--teal-rgb),0.06)",
              border: "1px solid rgba(var(--teal-rgb),0.2)",
              borderRadius: 16,
              padding: "24px 28px",
              marginBottom: 32,
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
            }}
          >
            <span
              className="mono"
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--teal)",
                background: "rgba(var(--teal-rgb),0.12)",
                border: "1px solid rgba(var(--teal-rgb),0.3)",
                borderRadius: 100,
                padding: "4px 12px",
                textTransform: "uppercase",
              }}
            >
              {t("sampleInsightLabel")}
            </span>
            <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>{t("sampleInsightText")}</p>
          </div>

          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "flex", justifyContent: "center" }}>
            <CapabilityPyramid dimensionLevels={SAMPLE_AVERAGES} />
          </div>
        </section>
      ),
    },
    {
      key: "succession",
      label: t("navSuccession"),
      content: (
        <section id="succession" style={{ padding: "0 24px 100px", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
              {t("successionLabel")}
            </span>
            <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 12, color: "var(--text)" }}>
              {t("successionHeadline")}
            </h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 16, maxWidth: 640, margin: "16px auto 0", lineHeight: 1.7 }}>
              {t("successionSubtext")}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { name: "Priya Kapoor", fit: 68, reasoning: t("successionRank1Reasoning"), gap: t("successionRank1Gap") },
              { name: "Amara Osei", fit: 65, reasoning: t("successionRank2Reasoning"), gap: t("successionRank2Gap") },
              { name: "Daniel Mensah", fit: 44, reasoning: t("successionRank3Reasoning"), gap: t("successionRank3Gap") },
            ].map((c, i) => (
              <div
                key={c.name}
                style={{
                  background: "var(--navy-mid)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "22px 26px",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <div
                  className="mono"
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 15,
                    color: i === 0 ? "#0A0F1E" : "var(--text)",
                    background: i === 0 ? "var(--teal)" : "rgba(255,255,255,0.06)",
                    border: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  {i + 1}
                </div>
                <Avatar name={c.name} avatarUrl={null} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{c.name}</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>
                      {t("successionFitLabel", { percent: c.fit })}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 4 }}>{c.reasoning}</p>
                  <p style={{ fontSize: 12.5, color: "var(--amber)", lineHeight: 1.6 }}>{c.gap}</p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 24, maxWidth: 600, marginInline: "auto", lineHeight: 1.7 }}>
            {t("successionDisclaimer")}
          </p>
        </section>
      ),
    },
    {
      key: "capabilities",
      label: t("navCapabilities"),
      content: (
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
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
                {t("capabilitiesLabel")}
              </span>
              <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 12, color: "var(--text)" }}>
                {t("capabilitiesHeadline")}
              </h2>
            </div>
            {/* Hairline-divider grid (Zoho-suite structure, dark-theme
                translation): the 1px gap over a border-colored background
                paints clean internal gridlines at any column count, with a
                single rounded, clipped outer frame — no floating cards. No
                per-cell CTA on purpose: these are features of one product,
                not separate apps to "try" individually. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 1,
                background: "var(--border)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {capabilities.map((c) => (
                <div key={c.title} style={{ background: "var(--navy)", padding: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
                      {c.title}
                    </h3>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--teal)",
                        background: "rgba(var(--teal-rgb),0.1)",
                        border: "1px solid rgba(var(--teal-rgb),0.2)",
                      }}
                    >
                      <c.icon size={18} />
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ),
    },
    {
      key: "how-it-works",
      label: tCommon("howItWorks"),
      content: (
        <section id="how-it-works" style={{ padding: "100px 24px", maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
              {t("howItWorksLabel")}
            </span>
            <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 12, color: "var(--text)" }}>
              {t("howItWorksHeadline")}
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {steps.map((s) => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <div
                  className="mono"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(var(--teal-rgb),0.1)",
                    border: "1px solid rgba(var(--teal-rgb),0.3)",
                    color: "var(--teal)",
                    fontWeight: 600,
                    fontSize: 17,
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
      ),
    },
  ];

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
                background: "rgba(var(--teal-rgb),0.08)",
                border: "1px solid rgba(var(--teal-rgb),0.2)",
                borderRadius: 100,
                padding: "6px 16px",
                marginBottom: 32,
                fontSize: 13,
                color: "var(--teal)",
                fontWeight: 600,
              }}
            >
              {t("badge")}
            </span>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginBottom: 24,
                color: "var(--text)",
              }}
            >
              {t("heroTitlePrefix")}{" "}
              <span className="gradient-text">{t("heroTitleHighlight")}</span>
            </h1>
            <p
              style={{
                fontSize: "clamp(1rem, 2.2vw, 1.2rem)",
                color: "var(--text-muted)",
                lineHeight: 1.7,
                maxWidth: 600,
                margin: "0 auto 20px",
              }}
            >
              {t("heroSubtext")}
            </p>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--text-muted)",
                lineHeight: 1.6,
                maxWidth: 560,
                margin: "0 auto 40px",
                opacity: 0.8,
              }}
            >
              {t("heroArchitectureNote")}
            </p>
            {/* Self-serve and sales-assisted paths side by side — the page's
                own "How it works" section says signup takes under a minute
                with no sales call required, so "Talk to sales" can't be the
                only CTA without contradicting that claim. */}
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
                {t("ctaSetup")}
              </Link>
              <Link
                href="/contact?type=sales"
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
                {t("talkToSales")}
              </Link>
            </div>
            <p style={{ marginTop: 16 }}>
              <a href="#capabilities" style={{ color: "var(--teal)", textDecoration: "none", fontSize: 13.5, fontWeight: 600 }}>
                {t("ctaSeeIncluded")} →
              </a>
            </p>
          </div>
        </section>

        <SectionTabs tabs={tabs} pagePath="/enterprise" />

        <Reveal>
        <section
          style={{
            padding: "80px 24px 100px",
            textAlign: "center",
            borderTop: "1px solid var(--border)",
          }}
        >
          <h2 className="font-display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 16 }}>
            {t("finalHeadline")}
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
            {t("finalSubtextPrefix")}{" "}
            <Link href="/#pricing" style={{ color: "var(--teal)", textDecoration: "none" }}>
              {t("finalSubtextLink")}
            </Link>
            {t("finalSubtextSuffix")}
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
              {t("ctaSetup")}
            </Link>
            <Link
              href="/contact?type=sales"
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
              {t("talkToSales")}
            </Link>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20 }}>
            {t("preferEmailPrefix")}{" "}
            <a href="mailto:sales@devometrics.com" style={{ color: "var(--teal)", textDecoration: "none" }}>
              sales@devometrics.com
            </a>{" "}
            {t("preferEmailSupport")}{" "}
            <a href="mailto:support@devometrics.com" style={{ color: "var(--teal)", textDecoration: "none" }}>
              support@devometrics.com
            </a>
          </p>
        </section>
        </Reveal>
      </main>
      <Footer />
      <PlatformChatWidget />
    </>
  );
}
