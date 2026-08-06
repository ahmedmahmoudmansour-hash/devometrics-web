import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import CreateScenarioForm from "@/components/dashboard/CreateScenarioForm";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { hasOrganizationMembership } from "@/lib/organizations/membership";
import type { Profile } from "@/lib/supabase/types";

export default async function NewScenarioPage() {
  const t = await getTranslations("roleplayNewScenarioPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, hasOrgMembership] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    hasOrganizationMembership(supabase, user.id),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/roleplay" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("allScenarios")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {t("description")}
          </p>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null, hasOrgMembership)}
          feature={t("premiumFeature")}
          description={t("premiumDescription")}
        >
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <CreateScenarioForm />
          </div>
        </PremiumGate>
      </div>
    </div>
  );
}
