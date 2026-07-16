import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// display:"swap" so text paints in the metric-compatible fallback stack
// immediately rather than blocking on the webfont.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// A second, distinct typeface reserved for headlines only (marketing pages —
// see .font-display in globals.css) — Inter alone reads as competent SaaS
// default; pairing it with a geometric display face for large headline
// moments is the detail that separates "clean" from "distinctive" without
// touching body copy legibility anywhere.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  // Without metadataBase, Next can't resolve relative Open Graph / canonical
  // URLs and warns on every build — set it once here so share previews and
  // canonicals point at the real origin.
  metadataBase: new URL("https://www.devometrics.com"),
  title: "Devometrics — The Science of Career Growth",
  description:
    "AI-powered talent intelligence and development platform. Upload your CV, a job description, and your ambitions — get a prioritized, time-bound plan to close the gap.",
  keywords: ["career development", "AI career coach", "skill gap analysis", "talent intelligence"],
  openGraph: {
    title: "Devometrics — The Science of Career Growth",
    description: "Upload your CV, a job description, and your ambitions — get a precise competency gap map and a time-bound plan to close it.",
    siteName: "Devometrics",
    type: "website",
    url: "https://www.devometrics.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Devometrics — The Science of Career Growth",
    description: "A precise competency gap map and a time-bound plan to close it.",
  },
};

// Runs synchronously before paint to avoid a flash of the wrong theme —
// standard pattern for theme toggles that can't wait for React hydration.
const themeScript = `(function(){try{var t=localStorage.getItem('devometrics-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full`}
      // The theme script above intentionally sets data-theme on this exact
      // element before hydration runs, to avoid a flash of the wrong theme
      // — server-rendered HTML can never know localStorage, so this one
      // attribute always mismatches on a light-theme visitor and always
      // will, by design. Expected divergence, not a real bug — this is
      // the documented React/Next.js escape hatch for exactly this case.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased" style={{ background: "var(--navy)", color: "var(--text)" }}>
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
