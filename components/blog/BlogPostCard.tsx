"use client";

import Link from "next/link";
import type { BlogPost } from "@/lib/blog/posts";

const CATEGORY_COLORS: Record<string, string> = {
  "Career Development": "var(--teal)",
  Leadership: "var(--amber)",
  "AI & Careers": "#8b9dff",
};

export default function BlogPostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      style={{
        display: "block",
        background: "var(--navy-mid)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        textDecoration: "none",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(0,201,167,0.3)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: CATEGORY_COLORS[post.category] ?? "var(--teal)",
        }}
      >
        {post.category}
      </span>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 10, marginBottom: 10, lineHeight: 1.35 }}>
        {post.title}
      </h2>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
        {post.excerpt}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {new Date(post.publishedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        {" · "}
        {post.readMinutes} min read
      </p>
    </Link>
  );
}
