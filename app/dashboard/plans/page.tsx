import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import PlanCard from "@/components/dashboard/PlanCard";
import NewPlanForm from "@/components/dashboard/NewPlanForm";
import { effectiveSubscriptionTier } from "@/lib/billing/subscriptionTier";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import type { DevelopmentPlan, Milestone, Profile } from "@/lib/supabase/types";

export const metadata = { title: "My Development — Devometrics" };

// The single home for development plans: create one, and see and update
// every plan and milestone in one place, with the same editable status
// control (In progress / Completed / Deferred) as the individual plan page.
// The dashboard home used to carry its own copy of the plan list and the
// create form; that duplicate is gone, so there is exactly one place to go.
// (Gap Analysis and Assessments can still generate a plan from their own
// results, but they land here.)
export default async function MyDevelopmentPage() {
  const t = await getTranslations("plansPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, organizationId] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    getMyOrganizationId(supabase, user.id),
  ]);

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
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>{t("emptyState")}</p>
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

        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>{t("newPlanTitle")}</p>
          <NewPlanForm
            subscriptionTier={effectiveSubscriptionTier(profile ?? null, !!organizationId)}
            existingPlanCount={(plans ?? []).length}
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
    </div>
  );
}
