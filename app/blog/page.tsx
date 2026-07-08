import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BlogPostCard from "@/components/blog/BlogPostCard";
import { BLOG_POSTS } from "@/lib/blog/posts";

export const metadata = { title: "Blog — Devometrics" };

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1));

  return (
    <>
      <Navbar />
      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            Blog
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 48, maxWidth: 600, lineHeight: 1.6 }}>
            Notes on career development, leadership, and where AI genuinely helps (and where it doesn&apos;t).
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {posts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
