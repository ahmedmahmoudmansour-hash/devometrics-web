import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import PlanCard from "@/components/dashboard/PlanCard";
import type { DevelopmentPlan, Milestone } from "@/lib/supabase/types";

export const metadata = { title: "My Development — Devometrics" };

// The consolidated tracking view "My Development" links to from the
// dashboard home — every plan and every milestone across all of them, in
// one place, with the same editable status control (In progress /
// Completed / Deferred) as the individual plan page. The per-plan pages
// still exist for export/printing a single plan; this is where you come to
// see and update everything at once instead of paging through plans one at
// a time.
export default async function MyDevelopmentPage() {
  const t = await getTranslations("plansPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plans } = await supabase
    .from("development_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<DevelopmentPlan[]>();

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: milestones } = planIds.length
    ? await supabase
        .from("milestones")
        .select("*")
        .in("plan_id", planIds)
        .returns<Milestone[]>()
    : { data: [] as Milestone[] };

  const allMilestones = milestones ?? [];
  // Falls back to "in_progress" only if the status column itself doesn't
  // exist yet (pre-migration-0066 database) — once 0066 has run, every row
  // has a real status, defaulting to "not_started" as of migration 0069.
  const statusOf = (m: Milestone) => m.status ?? "in_progress";
  const notStartedCount = allMilestones.filter((m) => statusOf(m) === "not_started").length;
  const completedCount = allMilestones.filter((m) => m.completed).length;
  const deferredCount = allMilestones.filter((m) => statusOf(m) === "deferred").length;
  const inProgressCount = allMilestones.length - notStartedCount - completedCount - deferredCount;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            {t("subtitle")}
          </p>
        </div>

        {(plans ?? []).length === 0 ? (
          <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("emptyStatePrefix")}{" "}
              <Link href="/dashboard" style={{ color: "var(--teal)" }}>
                {t("emptyStateLinkText")}
              </Link>{" "}
              {t("emptyStateSuffix")}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 28, background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text-muted)" }}>{notStartedCount}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("statusNotStarted")}</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--phase2)" }}>{inProgressCount}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("statusInProgress")}</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--teal)" }}>{completedCount}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("statusCompleted")}</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--amber)" }}>{deferredCount}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("statusDeferred")}</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {(plans ?? []).map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  milestones={allMilestones.filter((m) => m.plan_id === plan.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
