import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCustomScenario } from "@/lib/roleplay/customScenarios";
import RoleplayChat from "@/components/dashboard/RoleplayChat";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { hasOrganizationMembership } from "@/lib/organizations/membership";
import type { Profile, RoleplaySession } from "@/lib/supabase/types";

export default async function CustomScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("roleplayScenarioPage");
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scenario = await getCustomScenario(id, user.id);
  if (!scenario) notFound();

  const [{ data: latest }, { data: profile }, hasOrgMembership] = await Promise.all([
    supabase
      .from("roleplay_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("scenario_slug", id)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<RoleplaySession>(),
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    hasOrganizationMembership(supabase, user.id),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/roleplay" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("allScenarios")}
          </Link>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null, hasOrgMembership)}
          feature={t("premiumFeature")}
          description={t("premiumDescription")}
        >
          <RoleplayChat scenario={scenario} initialSession={latest ?? null} />
        </PremiumGate>
      </div>
    </div>
  );
}
