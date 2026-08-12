"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getMyOrganizationId } from "@/lib/organizations/membership";
import { listMyRestrictedFeatures } from "@/lib/organizations/featureAccess";
import type {
  PerformanceReviewCycle,
  PerformanceReview,
  SelfAssessment,
  ManagerAssessment,
  ReviewGoal,
  CompetencyRating,
  ReviewListItem,
  ReviewDetail,
  GoalStatus,
  UplineChainEntry,
  UplineSignoff,
  AppraisalCompetencyContext,
} from "./types";
import { getInstanceSteps, getInstanceStepsForReviews } from "./instanceSteps";
import type { CustomStepCompletion, CustomStepAggregate } from "./workflowTypes";
import { createAutomatedSingleEmployeeCycle } from "./cycleAutomation";
import { isRecipeEnabled, firedRecently, logAutomation } from "@/lib/automations/engine";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ---------- Admin: cycles ----------

export async function listReviewCycles(): Promise<{ cycles: PerformanceReviewCycle[]; error?: string }> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { cycles: [] };
  const supabase = await createClient();
  const { data: cycles, error } = await supabase
    .from("performance_review_cycles")
    .select("*")
    .eq("organization_id", data.organizationId)
    .order("created_at", { ascending: false })
    .returns<PerformanceReviewCycle[]>();
  if (error) return { cycles: [], error: "not_migrated" };
  return { cycles: cycles ?? [] };
}

export async function createReviewCycle(
  name: string,
  opensAt?: string | null,
  closesAt?: string | null,
  workflowTemplateId?: string | null,
  employeeUserIds?: string[] | null
) {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Give the cycle a name" };

  const { data: cycle, error } = await supabase
    .from("performance_review_cycles")
    .insert({
      organization_id: data.organizationId,
      name: trimmed,
      created_by: user.id,
      opens_at: opensAt?.trim() || null,
      closes_at: closesAt?.trim() || null,
      workflow_template_id: workflowTemplateId || null,
    })
    .select()
    .maybeSingle<PerformanceReviewCycle>();
  if (error || !cycle) return { error: "Could not create cycle — try again." };

  // Scopes the cycle to specific employees (e.g. a single-person probation
  // review) rather than the whole org — must be inserted before
  // ensure_reviews_for_cycle's first-ever seed so it already sees the
  // scope (migration 0109). An empty/omitted array leaves the cycle
  // unscoped, seeding every current org member exactly as before.
  if (employeeUserIds && employeeUserIds.length > 0) {
    await supabase.from("performance_review_cycle_participants").insert(
      employeeUserIds.map((employeeUserId) => ({ cycle_id: cycle.id, employee_user_id: employeeUserId }))
    );
  }

  // Seeds a review row for every current org member (or, if scoped above,
  // just the participants) — idempotent, so re-running (e.g. after new
  // hires join) is safe.
  await supabase.rpc("ensure_reviews_for_cycle", { target_cycle_id: cycle.id });

  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true, cycle };
}

export async function updateCycleStatus(cycleId: string, status: "draft" | "open" | "closed") {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return { error: "Not authorized" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("performance_review_cycles")
    .update({ status })
    .eq("id", cycleId)
    .eq("organization_id", data.organizationId);
  if (error) return { error: "Could not update — try again." };

  // Cover anyone who joined the org after the cycle was created.
  await supabase.rpc("ensure_reviews_for_cycle", { target_cycle_id: cycleId });

  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

// ---------- Admin: reviews within a cycle ----------

export async function listReviewsForCycle(cycleId: string): Promise<ReviewListItem[]> {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) return [];
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq("cycle_id", cycleId)
    .eq("organization_id", data.organizationId)
    .returns<PerformanceReview[]>();
  if (!reviews || reviews.length === 0) return [];

  const employeeIds = reviews.map((r) => r.employee_user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", employeeIds)
    .returns<{ id: string; full_name: string | null; email: string }[]>();
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const reviewIds = reviews.map((r) => r.id);
  const [{ data: selfRows }, { data: managerRows }] = await Promise.all([
    supabase
      .from("performance_review_self_assessments")
      .select("review_id, rating, reflection, key_strengths, recommendations, development_areas")
      .in("review_id", reviewIds)
      .returns<{ review_id: string; rating: number | null; reflection: string | null; key_strengths: string | null; recommendations: string | null; development_areas: string | null }[]>(),
    supabase.from("performance_review_manager_assessments").select("review_id, rating").in("review_id", reviewIds).returns<{ review_id: string; rating: number | null }[]>(),
  ]);
  const selfByReview = new Map((selfRows ?? []).map((r) => [r.review_id, r]));
  const managerByReview = new Map((managerRows ?? []).map((r) => [r.review_id, r.rating]));
  const stepsByReview = await getInstanceStepsForReviews(reviewIds);

  return reviews
    .map((r) => ({
      ...r,
      employeeName: profileById.get(r.employee_user_id)?.full_name ?? "Unknown",
      employeeEmail: profileById.get(r.employee_user_id)?.email ?? "",
      selfRating: selfByReview.get(r.id)?.rating ?? null,
      selfReflection: selfByReview.get(r.id)?.reflection ?? null,
      selfKeyStrengths: selfByReview.get(r.id)?.key_strengths ?? null,
      selfRecommendations: selfByReview.get(r.id)?.recommendations ?? null,
      selfDevelopmentAreas: selfByReview.get(r.id)?.development_areas ?? null,
      managerRating: managerByReview.get(r.id) ?? null,
      instanceSteps: stepsByReview.get(r.id) ?? [],
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

// ---------- Manager: direct reports (not necessarily an org admin) ----------

// Every direct report's current-cycle Impact Cycle review, for whoever the
// caller actually manages via the Org Chart's manager_user_id — no
// isOrgAdmin gate here at all, deliberately: RLS itself (0078's
// is_manager_of_user policies) is what scopes this to real direct reports,
// the same "let RLS be the actual boundary" posture as the rest of this
// feature. Returns [] for a plain individual contributor with no reports.
export async function listMyDirectReportReviews(): Promise<{ items: ReviewListItem[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [] };

  const { data: reports, error: reportsError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("manager_user_id", user.id)
    .returns<{ user_id: string }[]>();
  if (reportsError) return { items: [], error: "not_migrated" };
  if (!reports || reports.length === 0) return { items: [] };

  const reportIds = reports.map((r) => r.user_id);
  const { data: reviews, error: reviewsError } = await supabase
    .from("performance_reviews")
    .select("*, performance_review_cycles(name)")
    .in("employee_user_id", reportIds)
    .returns<(PerformanceReview & { performance_review_cycles: { name: string } })[]>();
  if (reviewsError) return { items: [], error: "not_migrated" };
  if (!reviews || reviews.length === 0) return { items: [] };

  // One row per direct report — their most recently created review across
  // any cycle, so a manager sees "current status" per person, not every
  // historical cycle stacked together.
  const latestByEmployee = new Map<string, PerformanceReview & { performance_review_cycles: { name: string } }>();
  for (const r of reviews) {
    const existing = latestByEmployee.get(r.employee_user_id);
    if (!existing || r.created_at > existing.created_at) latestByEmployee.set(r.employee_user_id, r);
  }
  const picked = [...latestByEmployee.values()];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", reportIds)
    .returns<{ id: string; full_name: string | null; email: string }[]>();
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const reviewIds = picked.map((r) => r.id);
  const [{ data: selfRows }, { data: managerRows }] = await Promise.all([
    supabase
      .from("performance_review_self_assessments")
      .select("review_id, rating, reflection, key_strengths, recommendations, development_areas")
      .in("review_id", reviewIds)
      .returns<{ review_id: string; rating: number | null; reflection: string | null; key_strengths: string | null; recommendations: string | null; development_areas: string | null }[]>(),
    supabase.from("performance_review_manager_assessments").select("review_id, rating").in("review_id", reviewIds).returns<{ review_id: string; rating: number | null }[]>(),
  ]);
  const selfByReview = new Map((selfRows ?? []).map((r) => [r.review_id, r]));
  const managerByReview = new Map((managerRows ?? []).map((r) => [r.review_id, r.rating]));
  const stepsByReview = await getInstanceStepsForReviews(reviewIds);

  const items: ReviewListItem[] = picked
    .map((r) => {
      const { performance_review_cycles, ...review } = r;
      return {
        ...review,
        employeeName: profileById.get(r.employee_user_id)?.full_name ?? "Unknown",
        employeeEmail: profileById.get(r.employee_user_id)?.email ?? "",
        selfRating: selfByReview.get(r.id)?.rating ?? null,
        selfReflection: selfByReview.get(r.id)?.reflection ?? null,
        selfKeyStrengths: selfByReview.get(r.id)?.key_strengths ?? null,
        selfRecommendations: selfByReview.get(r.id)?.recommendations ?? null,
        selfDevelopmentAreas: selfByReview.get(r.id)?.development_areas ?? null,
        managerRating: managerByReview.get(r.id) ?? null,
        cycleName: performance_review_cycles.name,
        instanceSteps: stepsByReview.get(r.id) ?? [],
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return { items };
}

export type PendingProbationAcceptance = {
  reviewId: string;
  employeeUserId: string;
  employeeName: string;
  cycleName: string;
  createdAt: string;
};

// Same "RLS is the real boundary" posture as listMyDirectReportReviews —
// scoped to the caller's own direct reports via manager_user_id, no admin
// gate. Only ever returns probation reviews still awaiting THIS manager's
// acceptance (migration 0122) — once accepted, a review drops out of this
// list on its own (the underlying row no longer matches the filter).
export async function getPendingProbationAcceptances(): Promise<PendingProbationAcceptance[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: reports } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("manager_user_id", user.id)
    .returns<{ user_id: string }[]>();
  if (!reports || reports.length === 0) return [];

  const reportIds = reports.map((r) => r.user_id);
  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select("id, employee_user_id, created_at, performance_review_cycles(name)")
    .in("employee_user_id", reportIds)
    .eq("requires_hiring_manager_acceptance", true)
    .is("hiring_manager_accepted_at", null)
    .returns<{ id: string; employee_user_id: string; created_at: string; performance_review_cycles: { name: string } }[]>();
  if (!reviews || reviews.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", reviews.map((r) => r.employee_user_id))
    .returns<{ id: string; full_name: string | null }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return reviews.map((r) => ({
    reviewId: r.id,
    employeeUserId: r.employee_user_id,
    employeeName: nameById.get(r.employee_user_id) ?? "Unknown",
    cycleName: r.performance_review_cycles.name,
    createdAt: r.created_at,
  }));
}

// Calls accept_probation_review (migration 0122) — the RPC does its own
// is_manager_of_user/is_org_admin check (RLS is bypassed inside a SECURITY
// DEFINER function), so this is a thin, defense-in-depth wrapper, not the
// real authorization boundary.
export async function acceptProbationReview(reviewId: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_probation_review", { target_review_id: reviewId });
  if (error) {
    console.error("acceptProbationReview failed:", error);
    return { error: "Could not accept — the database may need migration 0122 run first." };
  }
  revalidatePath("/dashboard/my-team");
  return { success: true };
}

export async function submitManagerAssessment(reviewId: string, rating: number, feedback: string, developmentNeeds: string) {
  const supabase = await createClient();
  const restrictedError = await performanceReviewRestrictedError(supabase);
  if (restrictedError) return { error: restrictedError };

  // development_needs now travels inside the RPC's own SECURITY DEFINER
  // upsert (migration 0103) — it used to be written via a plain client
  // .update() here, but that table has never had an INSERT/UPDATE RLS
  // policy for anyone, so the field silently never persisted. Fixed at the
  // source instead of papered over.
  const { error } = await supabase.rpc("submit_manager_assessment", {
    target_review_id: reviewId,
    p_rating: rating,
    p_feedback: feedback.trim(),
    p_development_needs: developmentNeeds.trim() || null,
  });
  if (error) {
    console.error("submitManagerAssessment failed:", error);
    return { error: "Could not save — try again." };
  }

  // Mid-year trigger (Part 5(e)) — a below-standard manager rating starts a
  // lighter mid-year check-in cycle ~6 months out, reusing Part 4's shared
  // automated-cycle helper (create_automated_review_cycle, migration 0122).
  // Dedup-guarded per employee (not per review — a resubmitted low rating on
  // the same review shouldn't spawn a second cycle) the same way
  // runHighPotentialToSuccession guards against re-firing on every rerun.
  // Best-effort: any failure here must never surface as a failure of the
  // manager's actual submission, which already succeeded above.
  if (rating < 2) {
    try {
      const { data: review } = await supabase
        .from("performance_reviews")
        .select("organization_id, employee_user_id")
        .eq("id", reviewId)
        .maybeSingle<{ organization_id: string; employee_user_id: string }>();
      if (review) {
        const enabled = await isRecipeEnabled(supabase, review.organization_id, "low_manager_rating_to_midyear");
        if (enabled) {
          const alreadyFired = await firedRecently(supabase, {
            organizationId: review.organization_id,
            recipeKey: "low_manager_rating_to_midyear",
            subjectUserId: review.employee_user_id,
            days: 300,
          });
          if (!alreadyFired) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", review.employee_user_id)
              .maybeSingle<{ full_name: string | null }>();
            const opensAt = new Date();
            opensAt.setMonth(opensAt.getMonth() + 6);
            const cycleName = `${profile?.full_name ?? "Employee"} — Mid-Year Check-in`;
            const created = await createAutomatedSingleEmployeeCycle(supabase, {
              employeeUserId: review.employee_user_id,
              starterKey: "mid_year_checkin",
              cycleName,
              opensAt: opensAt.toISOString().slice(0, 10),
            });
            if ("error" in created) {
              console.error("submitManagerAssessment: mid-year trigger failed:", created.error);
            } else {
              await logAutomation(supabase, {
                organizationId: review.organization_id,
                recipeKey: "low_manager_rating_to_midyear",
                subjectUserId: review.employee_user_id,
                summary: "Mid-year check-in cycle scheduled after a below-standard manager rating.",
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("submitManagerAssessment: mid-year trigger failed (non-fatal):", err);
    }
  }

  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

export async function addReviewGoal(reviewId: string, title: string, description?: string, target?: string) {
  const supabase = await createClient();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Give the goal a title" };

  const { error } = await supabase.from("performance_review_goals").insert({
    review_id: reviewId,
    title: trimmed,
    description: description?.trim() || null,
    target: target?.trim() || null,
  });
  if (error) return { error: "Could not add goal — try again." };

  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

export async function updateGoalStatus(goalId: string, status: GoalStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("performance_review_goals").update({ status }).eq("id", goalId);
  if (error) return { error: "Could not update — try again." };

  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

export async function updateGoalActual(goalId: string, actual: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("performance_review_goals").update({ actual: actual.trim() || null }).eq("id", goalId);
  if (error) return { error: "Could not update — try again." };

  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

export async function deleteReviewGoal(goalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("performance_review_goals").delete().eq("id", goalId);
  if (error) return { error: "Could not remove — try again." };

  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

export async function getReviewGoals(reviewId: string): Promise<ReviewGoal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_review_goals")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true })
    .returns<ReviewGoal[]>();
  return data ?? [];
}

// Finds the employee's Focus Areas from their most recent EARLIER cycle —
// "what did we set last time" for continuity, without assuming any
// particular cycle-naming convention (compares by the cycle's created_at,
// not its name).
async function fetchPastGoals(supabase: SupabaseServerClient, reviewId: string): Promise<ReviewGoal[]> {
  const { data: review } = await supabase
    .from("performance_reviews")
    .select("employee_user_id, cycle_id, performance_review_cycles(created_at)")
    .eq("id", reviewId)
    .maybeSingle<{ employee_user_id: string; cycle_id: string; performance_review_cycles: { created_at: string } }>();
  if (!review) return [];

  const { data: priorReviews } = await supabase
    .from("performance_reviews")
    .select("id, performance_review_cycles(created_at)")
    .eq("employee_user_id", review.employee_user_id)
    .neq("cycle_id", review.cycle_id)
    .returns<{ id: string; performance_review_cycles: { created_at: string } }[]>();
  if (!priorReviews || priorReviews.length === 0) return [];

  const earlier = priorReviews
    .filter((r) => r.performance_review_cycles.created_at < review.performance_review_cycles.created_at)
    .sort((a, b) => b.performance_review_cycles.created_at.localeCompare(a.performance_review_cycles.created_at));
  if (earlier.length === 0) return [];

  const { data: goals } = await supabase
    .from("performance_review_goals")
    .select("*")
    .eq("review_id", earlier[0].id)
    .order("created_at", { ascending: true })
    .returns<ReviewGoal[]>();
  return goals ?? [];
}

export async function getPastGoals(reviewId: string): Promise<ReviewGoal[]> {
  const supabase = await createClient();
  return fetchPastGoals(supabase, reviewId);
}

// ---------- Competency ratings ----------

export async function getCompetencyRatings(reviewId: string): Promise<CompetencyRating[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_review_competency_ratings")
    .select("*")
    .eq("review_id", reviewId)
    .returns<CompetencyRating[]>();
  return data ?? [];
}

export async function setCompetencyRating(
  reviewId: string,
  dimension: string,
  rating: number,
  note: string,
  organizationCompetencyId?: string | null
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_competency_rating", {
    target_review_id: reviewId,
    p_dimension: dimension,
    p_rating: rating,
    p_note: note.trim() || null,
    p_organization_competency_id: organizationCompetencyId ?? null,
  });
  if (error) {
    console.error("setCompetencyRating failed:", error);
    return { error: "Could not save — try again." };
  }
  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

// ---------- Conclusion & close ----------

export async function closeReview(reviewId: string, conclusion: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_review", {
    target_review_id: reviewId,
    p_conclusion: conclusion.trim(),
  });
  if (error) {
    console.error("closeReview failed:", error);
    return { error: error.message?.includes("Manager") ? "Submit the Manager's Perspective before closing the cycle" : "Could not close — try again." };
  }
  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

// ---------- Employee: their own review ----------

// Finds the employee's review in the most recently opened/closed cycle —
// "my current review" without making them pick a cycle themselves. A
// missing table (migration not run) and "no review assigned yet" both
// degrade to no detail, but are distinguished so the page can tell the two
// apart — one is a setup notice, the other is a normal empty state.
export async function getMyCurrentReview(): Promise<{ detail: ReviewDetail | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { detail: null };

  const { data: reviews, error } = await supabase
    .from("performance_reviews")
    .select("*, performance_review_cycles(*)")
    .eq("employee_user_id", user.id)
    .returns<(PerformanceReview & { performance_review_cycles: PerformanceReviewCycle })[]>();
  if (error) return { detail: null, error: "not_migrated" };
  if (!reviews || reviews.length === 0) return { detail: null };

  // Probation acceptance gate (migration 0122) — a review the hiring
  // manager hasn't accepted yet simply doesn't exist as far as the
  // employee's own view is concerned; they see nothing until it's accepted.
  const visible = reviews.filter((r) => !(r.requires_hiring_manager_acceptance && !r.hiring_manager_accepted_at));
  if (visible.length === 0) return { detail: null };

  // Prefer an open cycle; otherwise the most recently created one.
  const sorted = [...visible].sort((a, b) => {
    const aOpen = a.performance_review_cycles.status === "open" ? 1 : 0;
    const bOpen = b.performance_review_cycles.status === "open" ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return b.performance_review_cycles.created_at.localeCompare(a.performance_review_cycles.created_at);
  });
  const { performance_review_cycles: cycle, ...review } = sorted[0];

  const [{ data: self }, { data: manager }, { data: goals }, { data: competencyRatings }, pastGoals, { data: profile }, uplineSignoffs, instanceSteps] = await Promise.all([
    supabase.from("performance_review_self_assessments").select("*").eq("review_id", review.id).maybeSingle<SelfAssessment>(),
    supabase.from("performance_review_manager_assessments").select("*").eq("review_id", review.id).maybeSingle<ManagerAssessment>(),
    supabase.from("performance_review_goals").select("*").eq("review_id", review.id).order("created_at").returns<ReviewGoal[]>(),
    supabase.from("performance_review_competency_ratings").select("*").eq("review_id", review.id).returns<CompetencyRating[]>(),
    fetchPastGoals(supabase, review.id),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle<{ full_name: string | null; email: string }>(),
    getUplineSignoffs(review.id),
    getInstanceSteps(review.id),
  ]);

  return {
    detail: {
      review,
      cycle,
      self: self ?? null,
      manager: manager ?? null,
      goals: goals ?? [],
      pastGoals,
      competencyRatings: competencyRatings ?? [],
      employeeName: profile?.full_name ?? "You",
      employeeEmail: profile?.email ?? "",
      uplineSignoffs: uplineSignoffs.filter((s) => s.signed_off_at !== null),
      instanceSteps,
    },
  };
}

// Shared by every mutating action below — the module's RPCs all rely on
// their own SECURITY DEFINER auth.uid() context and never took a `user`
// param before, so this is the one place that needs to actually fetch the
// caller to check their restriction status.
async function performanceReviewRestrictedError(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";
  const organizationId = await getMyOrganizationId(supabase, user.id);
  const restricted = await listMyRestrictedFeatures(supabase, organizationId);
  if (restricted.has("performance_review")) {
    return "Performance Reviews have been restricted for your account by your company administrator.";
  }
  return null;
}

export async function submitSelfAssessment(
  reviewId: string,
  rating: number,
  reflection: string,
  keyStrengths: string,
  recommendations: string,
  developmentAreas: string
) {
  const supabase = await createClient();
  const restrictedError = await performanceReviewRestrictedError(supabase);
  if (restrictedError) return { error: restrictedError };

  const { error } = await supabase.rpc("submit_self_assessment", {
    target_review_id: reviewId,
    p_rating: rating,
    p_reflection: reflection.trim(),
    p_key_strengths: keyStrengths.trim() || null,
    p_recommendations: recommendations.trim() || null,
    p_development_areas: developmentAreas.trim() || null,
  });
  if (error) {
    console.error("submitSelfAssessment failed:", error);
    return { error: "Could not save — the database may need migration 0123 run first." };
  }
  revalidatePath("/dashboard/impact-cycle");
  return { success: true };
}

export async function acknowledgeReview(reviewId: string, comment: string) {
  const supabase = await createClient();
  const restrictedError = await performanceReviewRestrictedError(supabase);
  if (restrictedError) return { error: restrictedError };

  const { error } = await supabase.rpc("acknowledge_review", {
    target_review_id: reviewId,
    p_comment: comment.trim(),
  });
  if (error) {
    console.error("acknowledgeReview failed:", error);
    return { error: "Could not save — try again." };
  }
  revalidatePath("/dashboard/impact-cycle");
  return { success: true };
}

// ---------- Escalation: skip-level visibility + co-sign ----------

// Lets a client component that's already deep in the performanceReviews
// data-loading flow tell "is this upline-chain row me" apart from "someone
// else in the chain" without threading auth state down as a prop.
export async function getMyUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Walks organization_members.manager_user_id upward from the review's
// employee, one hop at a time, up to the org's configured
// review_escalation_levels — same cap the RLS-side upline_level_of_user()
// enforces, kept in sync here purely to bound how many round trips this
// makes (RLS is still the real boundary on what's actually readable).
export async function getUplineChain(reviewId: string): Promise<UplineChainEntry[]> {
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("performance_reviews")
    .select("employee_user_id, organization_id")
    .eq("id", reviewId)
    .maybeSingle<{ employee_user_id: string; organization_id: string }>();
  if (!review) return [];

  const { data: org } = await supabase
    .from("organizations")
    .select("review_escalation_levels")
    .eq("id", review.organization_id)
    .maybeSingle<{ review_escalation_levels: number | null }>();
  const maxLevel = Math.min(org?.review_escalation_levels ?? 1, 10);

  const chain: { level: number; managerUserId: string }[] = [];
  let current = review.employee_user_id;
  for (let level = 1; level <= maxLevel; level++) {
    const { data: member } = await supabase
      .from("organization_members")
      .select("manager_user_id")
      .eq("user_id", current)
      .eq("organization_id", review.organization_id)
      .maybeSingle<{ manager_user_id: string | null }>();
    if (!member?.manager_user_id) break;
    chain.push({ level, managerUserId: member.manager_user_id });
    current = member.manager_user_id;
  }
  if (chain.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", chain.map((c) => c.managerUserId))
    .returns<{ id: string; full_name: string | null }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

  return chain.map((c) => ({ level: c.level, managerUserId: c.managerUserId, managerName: nameById.get(c.managerUserId) ?? "Unknown" }));
}

export async function getUplineSignoffs(reviewId: string): Promise<UplineSignoff[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_review_upline_signoffs")
    .select("*")
    .eq("review_id", reviewId)
    .returns<UplineSignoff[]>();
  if (!data || data.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", data.map((s) => s.manager_user_id))
    .returns<{ id: string; full_name: string | null }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

  return data.map((s) => ({ ...s, managerName: nameById.get(s.manager_user_id) ?? "Unknown" }));
}

// Level (2+) is computed server-side from the Org Chart itself
// (upline_level_of_user, inside the RPC) — never trusted from the client.
export async function submitUplineSignoff(reviewId: string, comment: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_upline_signoff", {
    target_review_id: reviewId,
    p_comment: comment,
  });
  if (error) {
    console.error("submitUplineSignoff failed:", error);
    return { error: "Could not save — try again." };
  }
  revalidatePath("/dashboard/company/impact-cycles");
  return { success: true };
}

// ---------- Appraisal context: what the role requires + what's measured ----------

// Reference numbers shown alongside the manager's own competency rating —
// never written into performance_review_competency_ratings itself, since
// the manager's rating is their own independent judgment call, not a
// copy of the role profile or the Gap Analysis score.
export async function getAppraisalCompetencyContext(reviewId: string): Promise<AppraisalCompetencyContext[]> {
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("performance_reviews")
    .select("employee_user_id, organization_id")
    .eq("id", reviewId)
    .maybeSingle<{ employee_user_id: string; organization_id: string }>();
  if (!review) return [];

  const { data: member } = await supabase
    .from("organization_members")
    .select("current_role_id")
    .eq("user_id", review.employee_user_id)
    .eq("organization_id", review.organization_id)
    .maybeSingle<{ current_role_id: string | null }>();

  const roleTargetByDim = new Map<string, number>();
  if (member?.current_role_id) {
    const { data: requirements } = await supabase
      .from("role_competency_requirements")
      .select("dimension, target_level")
      .eq("role_id", member.current_role_id)
      .returns<{ dimension: string; target_level: number }[]>();
    for (const r of requirements ?? []) roleTargetByDim.set(r.dimension, r.target_level);
  }

  const measuredByDim = new Map<string, number>();
  const { data: latestAnalysis } = await supabase
    .from("gap_analyses")
    .select("competencies")
    .eq("user_id", review.employee_user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ competencies: { dimension: string; currentLevel: number }[] }>();
  for (const c of latestAnalysis?.competencies ?? []) measuredByDim.set(c.dimension, c.currentLevel);

  const dimensions = new Set([...roleTargetByDim.keys(), ...measuredByDim.keys()]);
  return [...dimensions].map((dimension) => ({
    dimension,
    roleTarget: roleTargetByDim.get(dimension) ?? null,
    measuredCurrent: measuredByDim.get(dimension) ?? null,
  }));
}

// ---------- Generic custom steps ----------
//
// Every custom step (Peer Feedback, HR Review, Executive Approval, ...)
// reuses this same generic mechanism — see migration 0103's Part 4. Writes
// only ever happen through the RPCs below, mirroring the rest of this file.

export async function assignCustomStepResponder(instanceStepId: string, assigneeUserId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_custom_step_responder", {
    target_instance_step_id: instanceStepId,
    p_assignee_user_id: assigneeUserId,
  });
  if (error) {
    console.error("assignCustomStepResponder failed:", error);
    return { error: error.message?.includes("maximum") ? error.message : "Could not assign — try again." };
  }
  revalidatePath("/dashboard/company/impact-cycles");
  revalidatePath("/dashboard/my-team");
  return { success: true };
}

export async function unassignCustomStepResponder(instanceStepId: string, assigneeUserId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unassign_custom_step_responder", {
    target_instance_step_id: instanceStepId,
    p_assignee_user_id: assigneeUserId,
  });
  if (error) {
    console.error("unassignCustomStepResponder failed:", error);
    return { error: "Could not remove — try again." };
  }
  revalidatePath("/dashboard/company/impact-cycles");
  revalidatePath("/dashboard/my-team");
  return { success: true };
}

export async function getMyCustomStepAssignments(instanceStepId: string): Promise<{ assigneeUserId: string; assigneeName: string }[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("performance_review_custom_step_assignments")
    .select("assignee_user_id")
    .eq("instance_step_id", instanceStepId)
    .returns<{ assignee_user_id: string }[]>();
  if (!rows || rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", rows.map((r) => r.assignee_user_id))
    .returns<{ id: string; full_name: string | null }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

  return rows.map((r) => ({ assigneeUserId: r.assignee_user_id, assigneeName: nameById.get(r.assignee_user_id) ?? "Unknown" }));
}

export async function submitCustomStepResponse(instanceStepId: string, response: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_custom_step_response", {
    target_instance_step_id: instanceStepId,
    p_response: response,
  });
  if (error) {
    console.error("submitCustomStepResponse failed:", error);
    return { error: "Could not save your response — try again." };
  }
  revalidatePath("/dashboard/company/impact-cycles");
  revalidatePath("/dashboard/my-team");
  revalidatePath("/dashboard/impact-cycle");
  return { success: true };
}

export async function getMyCustomStepResponse(instanceStepId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("performance_review_custom_step_responses")
    .select("response, submitted_at")
    .eq("instance_step_id", instanceStepId)
    .eq("responder_user_id", user.id)
    .maybeSingle<{ response: Record<string, unknown>; submitted_at: string | null }>();
  return data?.submitted_at ? data.response : null;
}

export async function getCustomStepCompletion(instanceStepId: string): Promise<CustomStepCompletion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_custom_step_completion", { target_instance_step_id: instanceStepId })
    .maybeSingle<CustomStepCompletion>();
  if (error) return null;
  return data ?? null;
}

// Attributed view (admin/manager/upline) — every response with its
// responder's name, used to render "who said what" for non-anonymized
// custom steps.
export async function getCustomStepResponses(instanceStepId: string): Promise<{ responderUserId: string; responderName: string; response: Record<string, unknown>; submittedAt: string | null }[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("performance_review_custom_step_responses")
    .select("responder_user_id, response, submitted_at")
    .eq("instance_step_id", instanceStepId)
    .returns<{ responder_user_id: string; response: Record<string, unknown>; submitted_at: string | null }[]>();
  if (!rows || rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", rows.map((r) => r.responder_user_id))
    .returns<{ id: string; full_name: string | null }[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));

  return rows.map((r) => ({
    responderUserId: r.responder_user_id,
    responderName: nameById.get(r.responder_user_id) ?? "Unknown",
    response: r.response,
    submittedAt: r.submitted_at,
  }));
}

// Anonymized pooled view for the reviewed employee on peer/360 steps — see
// get_custom_step_aggregate_for_employee (0103) for the anonymity guarantee
// (no responder identity ever selected, 3-respondent floor before anything
// is returned).
export async function getCustomStepAggregateForEmployee(instanceStepId: string): Promise<CustomStepAggregate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_custom_step_aggregate_for_employee", { target_instance_step_id: instanceStepId })
    .maybeSingle<CustomStepAggregate>();
  if (error) return null;
  return data ?? null;
}
