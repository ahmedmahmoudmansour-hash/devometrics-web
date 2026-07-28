import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PlatformChatWidget from "@/components/PlatformChatWidget";
import CapabilityPyramid from "@/components/CapabilityPyramid";
import Avatar from "@/components/Avatar";
import Reveal from "@/components/Reveal";
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
                margin: "0 auto 40px",
              }}
            >
              {t("heroSubtext")}
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
                {t("ctaSeeIncluded")}
              </a>
            </div>
          </div>
        </section>

        <Reveal>
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

          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "flex", justifyContent: "center" }}>
            <CapabilityPyramid dimensionLevels={SAMPLE_AVERAGES} />
          </div>
        </section>
        </Reveal>

        <Reveal>
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
                        background: "rgba(0,201,167,0.1)",
                        border: "1px solid rgba(0,201,167,0.2)",
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
        </Reveal>

        <Reveal>
        <section style={{ padding: "100px 24px", maxWidth: 1000, margin: "0 auto" }}>
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
                    background: "rgba(0,201,167,0.1)",
                    border: "1px solid rgba(0,201,167,0.3)",
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
        </Reveal>

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
