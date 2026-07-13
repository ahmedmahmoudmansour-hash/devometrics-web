import type { MetadataRoute } from "next";

const BASE_URL = "https://www.devometrics.com";

// The site had no robots rules, so crawlers had no guidance and the
// authenticated app + API were fair game to index. Allow the public
// marketing site, keep the signed-in product and API endpoints out of
// search results, and point to the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/reset-password"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
