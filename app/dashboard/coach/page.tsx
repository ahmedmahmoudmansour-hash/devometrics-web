import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CoachChat from "@/components/dashboard/CoachChat";
import CoachMemoryCard from "@/components/dashboard/CoachMemoryCard";
import type { CoachGrowMemory, CoachMessage, Profile } from "@/lib/supabase/types";

export default async function CoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
              ← Back to progress
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
              AI Career Coach
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
            📅 Book sessions
          </Link>
        </div>
        <CoachMemoryCard memory={growMemory ?? null} />
        <CoachChat
          initialMessages={messages ?? []}
          userName={profile?.full_name ?? "You"}
          userAvatarUrl={profile?.avatar_url ?? null}
          initialVoice={profile?.coach_voice ?? "off"}
        />
      </div>
    </div>
  );
}
