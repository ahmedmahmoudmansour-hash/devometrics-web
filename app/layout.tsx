import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// display:"swap" so text paints in the metric-compatible fallback stack
// immediately rather than blocking on the webfont.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Devometrics — The Science of Career Growth",
  description:
    "AI-powered talent intelligence and development platform. Upload your CV, a job description, and your ambitions — get a prioritized, time-bound plan to close the gap.",
  keywords: ["career development", "AI career coach", "skill gap analysis", "talent intelligence"],
  openGraph: {
    title: "Devometrics",
    description: "The science of career growth.",
    siteName: "Devometrics",
  },
};

// Runs synchronously before paint to avoid a flash of the wrong theme —
// standard pattern for theme toggles that can't wait for React hydration.
const themeScript = `(function(){try{var t=localStorage.getItem('devometrics-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased" style={{ background: "var(--navy)", color: "var(--text)" }}>
        {children}
      </body>
    </html>
  );
}
