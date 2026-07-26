import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "About — Devometrics" };

export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <>
      <Navbar />
      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginBottom: 32,
            }}
          >
            {t("title")}
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, fontSize: 15, color: "var(--text-muted)", lineHeight: 1.8 }}>
            <p>{t("p1")}</p>
            <p>{t("p2")}</p>
            <p>{t("p3")}</p>
            <p>{t("p4")}</p>
          </div>

          <Link
            href="/contact"
            style={{
              display: "inline-block",
              marginTop: 28,
              background: "var(--teal)",
              color: "#0A0F1E",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              padding: "12px 22px",
              borderRadius: 10,
            }}
          >
            {t("cta")}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
