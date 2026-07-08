import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DiscoveryWizard from "@/components/dashboard/DiscoveryWizard";
import BigFiveAssessment from "@/components/dashboard/BigFiveAssessment";
import type { DiscoveryProfile, BigFiveProfile } from "@/lib/supabase/types";

export default async function DiscoveryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: latest } = await supabase
    .from("discovery_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<DiscoveryProfile>();

  const { data: latestBigFive } = await supabase
    .from("big_five_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BigFiveProfile>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            AI Discovery Interview
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            5 short questions about your actual day-to-day work — a richer starting profile
            than a job title alone.
          </p>
        </div>
        <DiscoveryWizard latest={latest} />
        <div style={{ marginTop: 24 }}>
          <BigFiveAssessment latest={latestBigFive} />
        </div>
      </div>
    </div>
  );
}
