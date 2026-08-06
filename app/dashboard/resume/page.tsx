import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import ResumeIntelligenceFlow from "@/components/dashboard/ResumeIntelligenceFlow";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { hasOrganizationMembership } from "@/lib/organizations/membership";
import type { Profile, ResumeAnalysis } from "@/lib/supabase/types";

export default async function ResumePage() {
  const t = await getTranslations("resumeIntelligencePage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: latest }, { data: profile }, hasOrgMembership] = await Promise.all([
    supabase
      .from("resume_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ResumeAnalysis>(),
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    hasOrganizationMembership(supabase, user.id),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null, hasOrgMembership)}
          feature={t("premiumFeature")}
          description={t("premiumDescription")}
        >
          <ResumeIntelligenceFlow latest={latest} />
        </PremiumGate>
      </div>
    </div>
  );
}
