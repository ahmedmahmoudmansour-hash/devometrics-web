import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Careers — Devometrics" };

export default function CareersPage() {
  return (
    <>
      <Navbar />
      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginBottom: 24,
            }}
          >
            Careers
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, fontSize: 15, color: "var(--text-muted)", lineHeight: 1.8 }}>
            <p>
              We don&apos;t have any open positions right now — Devometrics is run by a small, lean
              team, and we&apos;d rather be upfront about that than list roles we&apos;re not actually
              hiring for. When that changes, we&apos;ll post the role here.
            </p>
            <p>
              In the meantime, you&apos;re welcome to reach out any time at{" "}
              <a href="mailto:careers@devometrics.com" style={{ color: "var(--teal)" }}>
                careers@devometrics.com
              </a>{" "}
              — we do read those.
            </p>
          </div>

          <Link
            href="/contact?type=careers"
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
            Send us a message →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
