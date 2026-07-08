import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomScenario } from "@/lib/roleplay/customScenarios";
import RoleplayChat from "@/components/dashboard/RoleplayChat";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type { Profile, RoleplaySession } from "@/lib/supabase/types";

export default async function CustomScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scenario = await getCustomScenario(id, user.id);
  if (!scenario) notFound();

  const [{ data: latest }, { data: profile }] = await Promise.all([
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
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/roleplay" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← All scenarios
          </Link>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null)}
          feature="Interview Simulator"
          description="Practice this scenario with the AI playing the other person, in text or voice — upgrade to Premium to start."
        >
          <RoleplayChat scenario={scenario} initialSession={latest ?? null} />
        </PremiumGate>
      </div>
    </div>
  );
}
