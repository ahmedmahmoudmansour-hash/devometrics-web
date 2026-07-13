"use client";

import Link from "next/link";
import { useEffect } from "react";

// Global error boundary. Before this, an unhandled render error dropped the
// visitor onto Next.js's default error screen. Kept deliberately self-
// contained (no Navbar/Footer) since the failure could be anywhere in the
// tree — this only depends on the root layout's body + theme tokens.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the browser console and (in production) Vercel's logs, so
    // a real failure leaves a trace instead of vanishing behind the UI.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px",
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 13, color: "var(--danger)", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        Something broke
      </span>
      <h1
        style={{
          fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text)",
          margin: "12px 0",
        }}
      >
        This page hit an unexpected error
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 440 }}>
        It&apos;s not you — something went wrong on our end. Try again, and if it keeps happening,
        let us know.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            padding: "12px 24px",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
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
          Back to home
        </Link>
        <Link
          href="/contact?type=support"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
            padding: "12px 8px",
          }}
        >
          Contact support
        </Link>
      </div>
    </main>
  );
}
