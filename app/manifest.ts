import type { MetadataRoute } from "next";

// Makes the site installable (add-to-home-screen on mobile, app window on
// desktop) — the pragmatic mobile-app answer for this phase, on the same
// codebase, with no app-store process. A native app remains a future call.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Devometrics — The Science of Career Growth",
    short_name: "Devometrics",
    description:
      "AI-powered competency gap analysis, development plans, coaching, and interview practice.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A0F1E",
    theme_color: "#0A0F1E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
