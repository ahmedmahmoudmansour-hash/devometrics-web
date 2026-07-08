import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateScenarioForm from "@/components/dashboard/CreateScenarioForm";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type { Profile } from "@/lib/supabase/types";

export default async function NewScenarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/roleplay" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← All scenarios
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Create your own scenario
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Describe a real situation you&apos;re facing — the AI plays the other person and guides you
            through it, same as the built-in scenarios.
          </p>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null)}
          feature="Custom scenarios"
          description="Build your own Interview Simulator scenario from a real situation you're facing — upgrade to Premium to create one."
        >
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <CreateScenarioForm />
          </div>
        </PremiumGate>
      </div>
    </div>
  );
}
