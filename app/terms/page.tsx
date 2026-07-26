import { getTranslations } from "next-intl/server";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata = { title: "Terms of Service — Devometrics" };

export default async function TermsPage() {
  const t = await getTranslations("termsPage");

  return (
    <LegalPageShell title={t("title")} lastUpdated="2026-07-03">
      <LegalSection title={t("t1Title")}>
        <p>{t("t1Body")}</p>
      </LegalSection>

      <LegalSection title={t("t2Title")}>
        <p>
          {t("t2BodyAPrefix")} <strong>{t("t2BodyAStrong")}</strong> {t("t2BodyASuffix")}
        </p>
        <p>
          <strong>{t("t2BodyBStrong")}</strong> {t("t2BodyBSuffix")}
        </p>
      </LegalSection>

      <LegalSection title={t("t3Title")}>
        <p>{t("t3Body")}</p>
      </LegalSection>

      <LegalSection title={t("t4Title")}>
        <p>{t("t4Body")}</p>
      </LegalSection>

      <LegalSection title={t("t5Title")}>
        <p>{t("t5Body")}</p>
      </LegalSection>

      <LegalSection title={t("t6Title")}>
        <p>
          {t("t6BodyPrefix")}{" "}
          <a href="/privacy" style={{ color: "var(--teal)" }}>{t("t6LinkText")}</a> {t("t6BodySuffix")}
        </p>
      </LegalSection>

      <LegalSection title={t("t7Title")}>
        <p>{t("t7Body")}</p>
      </LegalSection>

      <LegalSection title={t("t8Title")}>
        <p>{t("t8Body")}</p>
      </LegalSection>

      <LegalSection title={t("t9Title")}>
        <p>{t("t9Body")}</p>
      </LegalSection>

      <LegalSection title={t("t10Title")}>
        <p>{t("t10Body")}</p>
      </LegalSection>

      <LegalSection title={t("questionsTitle")}>
        <p>
          {t("questionsPrefix")}{" "}
          <a href="mailto:support@devometrics.com" style={{ color: "var(--teal)" }}>
            support@devometrics.com
          </a>{" "}
          {t("questionsSuffix")}
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
