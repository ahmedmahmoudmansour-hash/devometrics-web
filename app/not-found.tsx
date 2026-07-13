import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Page not found — Devometrics" };

// Custom 404 — before this, a bad URL rendered Next.js's bare unstyled
// default, off-brand and with no way back. Copy plays on the product's own
// gap-analysis motif rather than a generic "Oops!" line.
export default function NotFound() {
  return (
    <>
      <Navbar />
      <main
        style={{
          minHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "140px 24px 100px",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: "clamp(3.5rem, 12vw, 6rem)",
            fontWeight: 700,
            color: "var(--teal)",
            lineHeight: 1,
            letterSpacing: "0.02em",
          }}
        >
          404
        </span>
        <h1
          style={{
            fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            margin: "20px 0 12px",
          }}
        >
          That&apos;s a gap we can&apos;t close
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 440 }}>
          The page you&apos;re looking for doesn&apos;t exist, or it moved. Everything else is still
          right where you left it.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/"
            style={{
              background: "var(--teal)",
              color: "#0A0F1E",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              padding: "12px 24px",
              borderRadius: 10,
            }}
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            style={{
              background: "transparent",
              color: "var(--text)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 24px",
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
          >
            Go to dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
