import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ResumeIntelligenceFlow from "@/components/dashboard/ResumeIntelligenceFlow";
import PremiumGate from "@/components/dashboard/PremiumGate";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import type { Profile, ResumeAnalysis } from "@/lib/supabase/types";

export default async function ResumePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: latest }, { data: profile }] = await Promise.all([
    supabase
      .from("resume_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ResumeAnalysis>(),
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
  ]);

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Resume Intelligence
          </h1>
        </div>
        <PremiumGate
          tier={effectiveSubscriptionTier(profile ?? null)}
          feature="Resume Intelligence"
          description="ATS score, achievement score, keyword matches, and weak-bullet analysis against a real target role — upgrade to Premium to run it."
        >
          <ResumeIntelligenceFlow latest={latest} />
        </PremiumGate>
      </div>
    </div>
  );
}
