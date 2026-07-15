import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlanExportBar from "@/components/dashboard/PlanExportBar";
import PlanCard from "@/components/dashboard/PlanCard";
import type { DevelopmentPlan, Milestone } from "@/lib/supabase/types";

export default async function PlanDetailPage({
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

  const { data: plan } = await supabase
    .from("development_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<DevelopmentPlan>();
  if (!plan) notFound();

  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("plan_id", id)
    .order("position", { ascending: true })
    .returns<Milestone[]>();

  const list = milestones ?? [];
  const done = list.filter((m) => m.completed).length;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="no-print" style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← Back to progress
          </Link>
        </div>

        <PlanExportBar planId={plan.id} title={plan.title} />

        <div
          className="print-plan"
          style={{
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 40,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span
              className="print-accent"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--teal)",
                textTransform: "uppercase",
              }}
            >
              Devometrics
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", marginTop: 10 }}>
              {plan.title}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
              {plan.horizon ? `${plan.horizon} plan · ` : ""}
              {done}/{list.length} milestones complete · Generated {new Date(plan.created_at).toLocaleDateString()}
            </p>
          </div>

          {list.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
              No milestones on this plan yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {list.map((m, i) => {
                const meta = [
                  m.target_date ? `Target: ${m.target_date}` : null,
                  m.weekly_hours ? `~${m.weekly_hours} hrs/${m.hours_period ?? "month"}` : null,
                  m.budget_note,
                ].filter(Boolean);
                return (
                  <div
                    key={m.id}
                    className="print-rule print-avoid-break"
                    style={{ padding: "18px 0", borderBottom: "1px solid var(--border)" }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                      <span
                        className="print-accent"
                        style={{ fontSize: 13, fontWeight: 800, color: "var(--teal)", flexShrink: 0 }}
                      >
                        {i + 1}.
                      </span>
                      <div style={{ flex: 1 }}>
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--text)",
                            textDecoration: m.completed ? "line-through" : "none",
                          }}
                        >
                          {m.title}
                          {m.completed && (
                            <span className="print-accent" style={{ color: "var(--teal)", fontWeight: 700, marginLeft: 8, fontSize: 12 }}>
                              ✓ Done
                            </span>
                          )}
                        </h3>
                        {m.description && (
                          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 6 }}>
                            {m.description}
                          </p>
                        )}
                        {meta.length > 0 && (
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                            {meta.join("  ·  ")}
                          </p>
                        )}
                        {m.success_indicator && (
                          <p className="print-accent" style={{ fontSize: 12, color: "var(--teal)", marginTop: 6, lineHeight: 1.5 }}>
                            Success indicator: {m.success_indicator}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 32, textAlign: "center" }}>
            AI-assisted development plan generated by Devometrics — not a certified professional
            evaluation or a guarantee of career outcomes.
          </p>
        </div>

        {/* The block above is a clean, print-optimized snapshot (used by the
            Download PDF button). This is the actual working view — check off
            milestones, add new ones, rename or delete the plan — kept
            separate and marked no-print so it never shows up in the export. */}
        <div className="no-print" style={{ marginTop: 32 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 14,
            }}
          >
            Manage this plan
          </p>
          <PlanCard plan={plan} milestones={list} showDetailLink={false} />
        </div>
      </div>
    </div>
  );
}
