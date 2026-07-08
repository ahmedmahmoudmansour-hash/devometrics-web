import { headers } from "next/headers";

// Vercel sets this automatically at the edge, for free, on every request —
// no third-party geolocation service or extra cost needed. Returns null if
// not running on Vercel (or otherwise undetectable), in which case callers
// should fall back to a manual region selector rather than assuming.
export async function detectVisitorCountry(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-vercel-ip-country");
}
