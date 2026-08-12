import type { Metadata } from "next";
import { IBM_Plex_Sans, Instrument_Serif, IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

// "Instrument" redesign body face — CSS variable name (--font-inter) is
// legacy, kept for the same reason the color tokens keep their old names
// (see the comment atop app/globals.css): renaming it would mean touching
// every file that references var(--font-inter). display:"swap" so text
// paints in the fallback stack immediately rather than blocking on the
// webfont.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
// A second, distinct typeface reserved for headlines only (marketing pages —
// see .font-display in globals.css) — a serif display face for large
// headline moments is the detail that separates "clean" from "distinctive"
// without touching body copy legibility anywhere. Instrument Serif ships
// only a single (regular) weight on Google Fonts, so no weight array is
// needed here.
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
// Instrument-readout mono face for figures/eyebrow labels (see .mono in
// globals.css) — 400/500 cover the regular and medium weights actually
// used there.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
// IBM Plex Sans / Instrument Serif have no Arabic glyphs at all — this is
// the font actually used for `dir="rtl"` content (see globals.css, applied
// via the same CSS-variable-swap pattern as the other two).
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

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
// Light is the default theme as of the "Instrument" redesign (bare :root
// in globals.css), so this only needs to opt IN to dark when a visitor
// explicitly chose it before; no attribute at all means light applies.
const themeScript = `(function(){try{var t=localStorage.getItem('devometrics-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read server-side from the devometrics-locale cookie (see
  // lib/i18n/request.ts) — unlike the theme/localStorage split below, this
  // is readable during SSR, so lang/dir are correct in the very first
  // server-rendered response with no hydration-mismatch escape hatch
  // needed for them specifically.
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${ibmPlexSans.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} ${ibmPlexSansArabic.variable} h-full`}
      // The theme script above intentionally sets data-theme on this exact
      // element before hydration runs, to avoid a flash of the wrong theme
      // — server-rendered HTML can never know localStorage, so this one
      // attribute always mismatches on a dark-theme visitor and always
      // will, by design. Expected divergence, not a real bug — this is
      // the documented React/Next.js escape hatch for exactly this case.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased" style={{ background: "var(--navy)", color: "var(--text)" }}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
