"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort boundary: renders when the root layout itself fails, so it must
// supply its own <html>/<body> and cannot rely on the theme or i18n.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b1020", color: "#f4f6fb", fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
          }}
        >
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", opacity: 0.75, maxWidth: 420 }}>
            The page failed to load. Please refresh; if it keeps happening, contact support.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: "#3f7a67", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}
          >
            Refresh
          </button>
        </main>
      </body>
    </html>
  );
}
