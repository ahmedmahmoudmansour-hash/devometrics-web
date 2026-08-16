import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PlatformChatWidget from "@/components/PlatformChatWidget";
import Reveal from "@/components/Reveal";
import EnterpriseSectionNav from "@/components/EnterpriseSectionNav";

export const metadata: Metadata = {
  title: "Devometrics for Enterprise — Workforce Intelligence",
  description:
    "One competency graph for your whole team — workforce skill inventory, talent heatmaps, standards-based Impact Cycle appraisals, and manager-assigned development tasks, built on the same engine every employee already uses individually.",
};

// Shared shell for every /enterprise/* route: Hero + section nav above the
// page content, closing CTA below it. Split out of the old single-page
// app/enterprise/page.tsx so each section (Decisions, Methodology, etc.)
// is a real route under this layout instead of a client-side tab panel —
// separate pages, same tab-styled nav, matching how the individual
// homepage looks while giving enterprise real per-section URLs.
export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("enterprisePage");

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
              <Link href="/enterprise/capabilities" style={{ color: "var(--teal)", textDecoration: "none", fontSize: 13.5, fontWeight: 600 }}>
                {t("ctaSeeIncluded")} →
              </Link>
            </p>
          </div>
        </section>

        <EnterpriseSectionNav />

        {children}

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
