import { getTranslations } from "next-intl/server";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata = { title: "Privacy Policy — Devometrics" };

export default async function PrivacyPage() {
  const t = await getTranslations("privacyPage");

  return (
    <LegalPageShell title={t("title")} lastUpdated="2026-07-03">
      <LegalSection title={t("s1Title")}>
        <p>{t("s1BodyA")}</p>
        <p>{t("s1BodyB")}</p>
        <p>{t("s1BodyC")}</p>
      </LegalSection>

      <LegalSection title={t("s2Title")}>
        <p>{t("s2Body")}</p>
      </LegalSection>

      <LegalSection title={t("s3Title")}>
        <p>{t("s3Body")}</p>
      </LegalSection>

      <LegalSection title={t("s4Title")}>
        <p>{t("s4Body")}</p>
      </LegalSection>

      <LegalSection title={t("s5Title")}>
        <p>{t("s5Body")}</p>
      </LegalSection>

      <LegalSection title={t("s6Title")}>
        <p>{t("s6BodyA")}</p>
        <p>
          {t("s6BodyBPrefix")} <strong>{t("s6BodyBStrong")}</strong>{t("s6BodyBSuffix")}
        </p>
      </LegalSection>

      <LegalSection title={t("s7Title")}>
        <p>{t("s7Body")}</p>
      </LegalSection>

      <LegalSection title={t("s8Title")}>
        <p>{t("s8Body")}</p>
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
