import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BridgeContentView from "@/components/dashboard/BridgeContentView";
import type { BridgeContent } from "@/lib/learning/bridgeContent";
import type { GapAnalysis } from "@/lib/supabase/types";

export default async function BridgeGapPage({
  params,
}: {
  params: Promise<{ dimension: string }>;
}) {
  const { dimension: encodedDimension } = await params;
  const dimension = decodeURIComponent(encodedDimension);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: analysis } = await supabase
    .from("gap_analyses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GapAnalysis>();

  const competency = analysis?.competencies.find((c) => c.dimension === dimension) ?? null;

  // Isolated defensive query (migration 0064 may not have run yet) —
  // matches the pattern used everywhere else in this app for newer tables.
  const { data: cached } = await supabase
    .from("gap_bridge_content")
    .select("content, generated_at")
    .eq("user_id", user.id)
    .eq("dimension", dimension)
    .maybeSingle<{ content: BridgeContent; generated_at: string }>();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/gap-analysis" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Gap Analysis
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            Bridge the gap: {dimension}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Generated from your actual measured score for this dimension — not a generic course
            catalog. A short lesson, a real next step, and resources verified by a live web search.
          </p>
        </div>

        {!competency ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              This dimension wasn&apos;t part of your most recent Gap Analysis —{" "}
              <Link href="/dashboard/gap-analysis" style={{ color: "var(--teal)" }}>
                run a new one
              </Link>{" "}
              to bridge a specific gap.
            </p>
          </div>
        ) : (
          <BridgeContentView
            dimension={dimension}
            currentLevel={competency.currentLevel}
            targetLevel={competency.targetLevel}
            cached={cached?.content ?? null}
            generatedAt={cached?.generated_at ?? null}
          />
        )}
      </div>
    </div>
  );
}
