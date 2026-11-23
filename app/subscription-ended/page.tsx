import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = { title: "Subscription ended — Devometrics" };

// Where the dashboard sends people whose company's trial or paid period has ended (migration 0213). Outside /dashboard on purpose, so the
// dashboard's own check cannot send them in a loop. Nothing is deleted: renewing brings everyone straight back to where they were.
export default async function SubscriptionEndedPage({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const t = await getTranslations("subscriptionEnded");
  const isAdmin = (await searchParams).admin === "1";

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "140px 24px 100px" }}>
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.1rem)", fontWeight: 800, color: "var(--text)", margin: "0 0 14px" }}>{t("title")}</h1>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 10px" }}>{isAdmin ? t("bodyAdmin") : t("bodyMember")}</p>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 24px" }}>{t("dataSafe")}</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {isAdmin && (
              <Link href="/contact" style={{ color: "var(--teal)", fontWeight: 700, textDecoration: "none" }}>{t("contact")}</Link>
            )}
            <Link href="/" style={{ color: "var(--text-muted)", fontWeight: 600, textDecoration: "none" }}>{t("home")}</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
