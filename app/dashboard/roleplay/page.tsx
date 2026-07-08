import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLEPLAY_SCENARIOS } from "@/lib/roleplay/scenarios";
import { LEVEL_SECTIONS, type LevelSection } from "@/lib/assessments/catalog";
import DeleteScenarioButton from "@/components/dashboard/DeleteScenarioButton";
import type { CustomScenario, RoleplaySession } from "@/lib/supabase/types";

const SECTION_ICON: Record<LevelSection, string> = {
  Foundational: "●",
  Professional: "◆",
  Leadership: "▲",
  Executive: "★",
};

export default async function RoleplayListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessions } = await supabase
    .from("roleplay_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<RoleplaySession[]>();

  const { data: customScenarios } = await supabase
    .from("custom_scenarios")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<CustomScenario[]>();

  const latestBySlug = new Map<string, RoleplaySession>();
  for (const s of sessions ?? []) {
    if (!latestBySlug.has(s.scenario_slug)) latestBySlug.set(s.scenario_slug, s);
  }

  const sections = LEVEL_SECTIONS.filter((s) =>
    ROLEPLAY_SCENARIOS.some((sc) => sc.level === s.key)
  );

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Interview & Scenario Simulator
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Practice real workplace conversations — the AI plays the other person and guides you
            through it, then gives you direct feedback on how you handled it.
          </p>
        </div>

        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Your custom scenarios</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            <Link
              href="/dashboard/roleplay/new"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "rgba(0,201,167,0.06)",
                border: "1px dashed rgba(0,201,167,0.4)",
                borderRadius: 14,
                padding: 20,
                textDecoration: "none",
                minHeight: 120,
              }}
            >
              <span style={{ fontSize: 24, color: "var(--teal)" }}>+</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--teal)" }}>Create your own scenario</span>
            </Link>
            {(customScenarios ?? []).map((cs) => {
              const session = latestBySlug.get(cs.id);
              return (
                <Link
                  key={cs.id}
                  href={`/dashboard/roleplay/custom/${cs.id}`}
                  style={{
                    position: "relative",
                    display: "block",
                    background: "var(--navy-mid)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 20,
                    textDecoration: "none",
                  }}
                >
                  <DeleteScenarioButton scenarioId={cs.id} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 4, marginBottom: 6, paddingRight: 50 }}>
                    {cs.title}
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 14 }}>
                    {cs.setup}
                  </p>
                  {session?.completed ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>Completed — try again →</span>
                  ) : session ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#f0b840" }}>In progress →</span>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Not started</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {sections.map((section) => {
          const items = ROLEPLAY_SCENARIOS.filter((s) => s.level === section.key);
          if (items.length === 0) return null;
          return (
            <div key={section.key} style={{ marginBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: "rgba(0,201,167,0.12)",
                    color: "var(--teal)",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {SECTION_ICON[section.key]}
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{section.label}</h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {items.map((s) => {
                  const session = latestBySlug.get(s.slug);
                  return (
                    <Link
                      key={s.slug}
                      href={`/dashboard/roleplay/${s.slug}`}
                      style={{
                        display: "block",
                        background: "var(--navy-mid)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        padding: 20,
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)", textTransform: "uppercase" }}>
                        {s.competencyFocus.join(" · ")}
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 8, marginBottom: 6 }}>
                        {s.title}
                      </h3>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 14 }}>
                        {s.setup}
                      </p>
                      {session?.completed ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>Completed — try again →</span>
                      ) : session ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#f0b840" }}>In progress →</span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Not started</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
