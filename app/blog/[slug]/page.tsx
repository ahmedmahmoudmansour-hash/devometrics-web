import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog/posts";
import { renderInlineMarkdown } from "@/lib/format/renderInlineMarkdown";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  return { title: post ? `${post.title} — Devometrics` : "Devometrics Blog" };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <>
      <Navbar />
      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Link href="/blog" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← All posts
          </Link>

          <span
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--teal)",
              marginTop: 24,
            }}
          >
            {post.category}
          </span>
          <h1
            style={{
              fontSize: "clamp(1.7rem, 4vw, 2.4rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginTop: 10,
              marginBottom: 10,
              lineHeight: 1.25,
            }}
          >
            {post.title}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 40 }}>
            {new Date(post.publishedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {" · "}
            {post.readMinutes} min read
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {post.sections.map((section, i) => (
              <div key={i}>
                {section.heading && (
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
                    {section.heading}
                  </h2>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {section.paragraphs.map((p, j) => (
                    <p key={j} style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.8 }}>
                      {renderInlineMarkdown(p)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 56,
              padding: 24,
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>
              See where your own gap actually is — run a free Devometrics gap analysis.
            </p>
            <Link
              href="/signup"
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
                padding: "10px 20px",
                borderRadius: 8,
                whiteSpace: "nowrap",
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
