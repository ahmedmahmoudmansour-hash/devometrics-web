import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog/posts";

const BASE_URL = "https://www.devometrics.com";

// Public routes only — the signed-in product is intentionally absent (see
// robots.ts). Blog posts are pulled from the same source the pages render
// from, so the sitemap can't drift out of sync when posts are added.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { path: "", priority: 1.0 },
    { path: "/enterprise", priority: 0.9 },
    { path: "/about", priority: 0.6 },
    { path: "/blog", priority: 0.7 },
    { path: "/careers", priority: 0.5 },
    { path: "/contact", priority: 0.6 },
    { path: "/login", priority: 0.4 },
    { path: "/signup", priority: 0.7 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    { path: "/data-ethics", priority: 0.4 },
    { path: "/cookies", priority: 0.3 },
  ];

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: r.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...blogEntries];
}
