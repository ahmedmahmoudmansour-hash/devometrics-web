import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "About — Devometrics" };

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginBottom: 32,
            }}
          >
            About Devometrics
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, fontSize: 15, color: "var(--text-muted)", lineHeight: 1.8 }}>
            <p>
              Devometrics is built on a simple premise: career development deserves the same rigor
              as any other discipline that takes measurement seriously. Not vague advice about
              &quot;growth areas,&quot; but an honest, structured read of the gap between where you are
              and where a specific role actually needs you to be — plus a plan to close it.
            </p>
            <p>
              We&apos;re a small, focused team building under Empiric Consultancy. We&apos;d rather ship
              something narrow and genuinely useful than something broad and generic, which is why
              the product leans on real inputs — your actual CV, a real target job description,
              structured competency frameworks — instead of one-size-fits-all career advice.
            </p>
            <p>
              We built the AI Coach and Interview Simulator because we think the two things that
              made executive coaching valuable — a continuous relationship and a safe place to
              rehearse hard conversations — shouldn&apos;t only be available to people with an
              executive coaching budget. And we built the gap analysis and Career Health Score
              because we think most career advice fails for a boring reason: it&apos;s never actually
              measured against you specifically.
            </p>
            <p>
              We&apos;re just getting started. We ship fast, we improve constantly, and we&apos;re
              adding new capabilities on a regular basis — this is a platform built to grow with the
              people who use it. If there&apos;s something you want to see next, we&apos;d genuinely like
              to hear about it.
            </p>
          </div>

          <Link
            href="/contact"
            style={{
              display: "inline-block",
              marginTop: 28,
              background: "var(--teal)",
              color: "#0A0F1E",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              padding: "12px 22px",
              borderRadius: 10,
            }}
          >
            Tell us what you&apos;d like to see →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
