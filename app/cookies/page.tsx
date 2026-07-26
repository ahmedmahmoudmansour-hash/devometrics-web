import { getTranslations } from "next-intl/server";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata = { title: "Cookie Policy — Devometrics" };

export default async function CookiesPage() {
  const t = await getTranslations("cookiesPage");

  return (
    <LegalPageShell title={t("title")} lastUpdated="2026-07-03">
      <LegalSection title={t("section1Title")}>
        <p>{t("section1Body")}</p>
      </LegalSection>

      <LegalSection title={t("section2Title")}>
        <p>{t("section2Body")}</p>
      </LegalSection>

      <LegalSection title={t("section3Title")}>
        <p>{t("section3Body")}</p>
      </LegalSection>

      <LegalSection title={t("section4Title")}>
        <p>{t("section4Body")}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
