import { getTranslations, getLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

export default async function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("legal");
  const locale = await getLocale();
  const dateLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  const formattedDate = new Date(lastUpdated).toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <Navbar />
      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32 }}>
            {t("lastUpdated", { date: formattedDate })}
          </p>

          <div
            style={{
              background: "rgba(var(--amber-rgb),0.08)",
              border: "1px solid rgba(var(--amber-rgb),0.25)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 40,
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--amber)" }}>{t("draftLabel")}</strong> {t("draftBody")}
          </div>

          <div
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.8,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
