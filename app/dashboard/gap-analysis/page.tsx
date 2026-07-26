import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import GapAnalysisFlow from "@/components/dashboard/GapAnalysisFlow";
import type { GapAnalysis, Profile } from "@/lib/supabase/types";

export default async function GapAnalysisPage() {
  const t = await getTranslations("gapAnalysisPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: latest } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GapAnalysis>();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

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
        <GapAnalysisFlow
          latest={latest}
          personalization={{
            location: profile?.location ?? "",
            learningPreferences: profile?.learning_preferences ?? [],
            careerStage: profile?.career_stage ?? "",
            accommodation: profile?.accommodation ?? "",
            resourceTier: profile?.resource_tier ?? "",
          }}
        />
      </div>
    </div>
  );
}
