import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Drops the "X-Powered-By: Next.js" response header — free fingerprinting
  // reduction, costs nothing.
  poweredByHeader: false,

  // pdf-parse ships its own worker/CanvasFactory setup that breaks if
  // Next.js bundles it into the serverless function instead of leaving it
  // as a real node_modules require — pdf-parse's own docs call this out
  // specifically for Vercel/serverless deployments.
  serverExternalPackages: ["pdf-parse"],

  async headers() {
    const sharedHeaders = [
      // Real browser-enforced protections (unlike JS obfuscation, these
      // actually constrain what a malicious page/frame/script can do):
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Don't leak the full referring URL (which can contain a plan ID,
      // session token in the path, etc.) to third-party sites linked
      // from the app; still send it for same-origin navigation.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Deny camera/geolocation outright; microphone stays limited to
      // our own origin since Coach/Roleplay voice input needs it.
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
      // Force HTTPS for a year, including subdomains — safe once
      // deployed since Vercel serves everything over HTTPS by default.
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      {
        // Every route EXCEPT the SCORM proxy gets full framing protection —
        // blocks this site from being embedded in an <iframe> anywhere,
        // preventing clickjacking (a transparent iframe of the dashboard
        // overlaid on a malicious page to hijack clicks). Excluded via a
        // negative-lookahead source rather than a second overlapping
        // headers() entry for the scorm route, because Next.js does not
        // reliably de-duplicate/override a repeated header key across two
        // matching entries — sending X-Frame-Options twice with different
        // values on the same response gets treated by Chrome as invalid and
        // blocks the frame anyway, which is exactly the bug this avoids.
        source: "/((?!api/knowledge-hub/scorm/).*)",
        headers: [...sharedHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // The SCORM proxy route serves an unpacked package's files, which
        // MUST be embeddable in an iframe on this same origin — the SCORM
        // 1.2 runtime bridge (KnowledgeHubScormRuntime.tsx) depends on the
        // content window being able to reach window.parent.API, which
        // requires the browser to load the frame at all. SAMEORIGIN (not
        // omitting the header) keeps every other origin blocked from
        // framing this route — only this app's own pages can embed it.
        source: "/api/knowledge-hub/scorm/:path*",
        headers: [...sharedHeaders, { key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

// Error monitoring (see sentry.*.config.ts and instrumentation*.ts). Build-time
// options only: source-map upload happens only when SENTRY_AUTH_TOKEN, ORG and
// PROJECT are all set in the build environment; otherwise the build is
// unchanged apart from the instrumentation hooks.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  telemetry: false,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
