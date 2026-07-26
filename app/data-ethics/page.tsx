import { getTranslations } from "next-intl/server";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata = { title: "Data Ethics — Devometrics" };

export default async function DataEthicsPage() {
  const t = await getTranslations("dataEthicsPage");

  return (
    <LegalPageShell title={t("title")} lastUpdated="2026-07-06">
      <LegalSection title={t("section1Title")}>
        <p>
          {t("section1BodyPrefix")}{" "}
          <a href="/terms" style={{ color: "var(--teal)" }}>{t("section1LinkText")}</a> {t("section1BodySuffix")}
        </p>
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

      <LegalSection title={t("section5Title")}>
        <p>{t("section5Body")}</p>
      </LegalSection>

      <LegalSection title={t("section6Title")}>
        <p>{t("section6Body")}</p>
      </LegalSection>

      <LegalSection title={t("section7Title")}>
        <p>{t("section7Body")}</p>
      </LegalSection>

      <LegalSection title={t("section8Title")}>
        <p>{t("section8Body")}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
