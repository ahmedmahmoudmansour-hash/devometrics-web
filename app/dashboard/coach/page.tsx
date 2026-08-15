import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import CoachChat from "@/components/dashboard/CoachChat";
import CoachMemoryCard from "@/components/dashboard/CoachMemoryCard";
import FeatureRestrictedNotice from "@/components/dashboard/FeatureRestrictedNotice";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import type { CoachGrowMemory, CoachMessage, Profile } from "@/lib/supabase/types";

export default async function CoachPage() {
  const t = await getTranslations("coachPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const organizationId = await getMyOrganizationId(supabase, user.id);
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("ai_coaching")) {
    return (
      <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
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

  const { data: messages } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<CoachMessage[]>();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, coach_voice")
    .eq("id", user.id)
    .single<Pick<Profile, "full_name" | "avatar_url" | "coach_voice">>();

  const { data: growMemory } = await supabase
    .from("coach_grow_memory")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<CoachGrowMemory>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div>
            <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
              {t("backToProgress")}
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
              {t("title")}
            </h1>
          </div>
          <Link
            href="/dashboard/coach/book"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 16px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {t("bookSessions")}
          </Link>
        </div>
        <CoachMemoryCard memory={growMemory ?? null} />
        {/* initialVoice was "off" — a brand-new profile has never explicitly
            chosen a voice, and defaulting to silent meant first-time users
            (and testers) experienced the Coach as mute with no obvious cue
            that Speech was a toggle away. "sarah" matches the fallback
            named voice already used elsewhere when switching Text -> Speech
            and back. An account that has explicitly set "off" keeps that
            choice — this only changes the fallback for profiles where
            coach_voice was never set at all. */}
        <CoachChat
          initialMessages={messages ?? []}
          userName={profile?.full_name ?? "You"}
          userAvatarUrl={profile?.avatar_url ?? null}
          initialVoice={profile?.coach_voice ?? "sarah"}
        />
      </div>
    </div>
  );
}
