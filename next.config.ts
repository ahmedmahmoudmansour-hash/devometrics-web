import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Drops the "X-Powered-By: Next.js" response header — free fingerprinting
  // reduction, costs nothing.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Real browser-enforced protections (unlike JS obfuscation, these
          // actually constrain what a malicious page/frame/script can do):
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Blocks this site from being embedded in an <iframe> anywhere —
          // prevents clickjacking (a transparent iframe of the dashboard
          // overlaid on a malicious page to hijack clicks).
          { key: "X-Frame-Options", value: "DENY" },
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
        ],
      },
    ];
  },
};

export default nextConfig;
