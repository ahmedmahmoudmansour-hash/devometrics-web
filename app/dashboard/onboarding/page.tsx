import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyOnboarding } from "@/lib/onboarding/actions";
import MyOnboardingChecklist from "@/components/dashboard/MyOnboardingChecklist";
import FeatureRestrictedNotice from "@/components/dashboard/FeatureRestrictedNotice";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";

export const metadata = { title: "Onboarding — Devometrics" };

export default async function MyOnboardingPage() {
  const t = await getTranslations("myOnboardingPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("onboarding")) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
              {t("backToProgress")}
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          </div>
          <FeatureRestrictedNotice message={t("restrictedNotice")} />
        </div>
      </div>
    );
  }

  const { steps } = await getMyOnboarding();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{t("title")}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>{t("description")}</p>
        </div>

        {steps.length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>{t("noneYet")}</p>
          </div>
        ) : (
          <MyOnboardingChecklist steps={steps} />
        )}
      </div>
    </div>
  );
}
