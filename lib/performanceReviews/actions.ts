"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildCompanyData } from "@/lib/organizations/aggregate";
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
} from "./types";

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

export async function createReviewCycle(name: string, opensAt?: string | null, closesAt?: string | null) {
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
    })
    .select()
    .maybeSingle<PerformanceReviewCycle>();
  if (error || !cycle) return { error: "Could not create cycle — try again." };

  // Seeds a review row for every current org member — idempotent, so
  // re-running (e.g. after new hires join) is safe.
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
    supabase.from("performance_review_self_assessments").select("review_id, rating").in("review_id", reviewIds).returns<{ review_id: string; rating: number | null }[]>(),
    supabase.from("performance_review_manager_assessments").select("review_id, rating").in("review_id", reviewIds).returns<{ review_id: string; rating: number | null }[]>(),
  ]);
  const selfByReview = new Map((selfRows ?? []).map((r) => [r.review_id, r.rating]));
  const managerByReview = new Map((managerRows ?? []).map((r) => [r.review_id, r.rating]));

  return reviews
    .map((r) => ({
      ...r,
      employeeName: profileById.get(r.employee_user_id)?.full_name ?? "Unknown",
      employeeEmail: profileById.get(r.employee_user_id)?.email ?? "",
      selfRating: selfByReview.get(r.id) ?? null,
      managerRating: managerByReview.get(r.id) ?? null,
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
    supabase.from("performance_review_self_assessments").select("review_id, rating").in("review_id", reviewIds).returns<{ review_id: string; rating: number | null }[]>(),
    supabase.from("performance_review_manager_assessments").select("review_id, rating").in("review_id", reviewIds).returns<{ review_id: string; rating: number | null }[]>(),
  ]);
  const selfByReview = new Map((selfRows ?? []).map((r) => [r.review_id, r.rating]));
  const managerByReview = new Map((managerRows ?? []).map((r) => [r.review_id, r.rating]));

  const items: ReviewListItem[] = picked
    .map((r) => {
      const { performance_review_cycles, ...review } = r;
      return {
        ...review,
        employeeName: profileById.get(r.employee_user_id)?.full_name ?? "Unknown",
        employeeEmail: profileById.get(r.employee_user_id)?.email ?? "",
        selfRating: selfByReview.get(r.id) ?? null,
        managerRating: managerByReview.get(r.id) ?? null,
        cycleName: performance_review_cycles.name,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return { items };
}

export async function submitManagerAssessment(reviewId: string, rating: number, feedback: string, developmentNeeds: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_manager_assessment", {
    target_review_id: reviewId,
    p_rating: rating,
    p_feedback: feedback.trim(),
  });
  if (error) {
    console.error("submitManagerAssessment failed:", error);
    return { error: "Could not save — try again." };
  }
  // development_needs isn't part of submit_manager_assessment's RPC surface
  // (that function's job is the rating + the performance_rating sync) — a
  // plain update here, same admin RLS policy already covers this table.
  await supabase.from("performance_review_manager_assessments").update({ development_needs: developmentNeeds.trim() || null }).eq("review_id", reviewId);

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

export async function setCompetencyRating(reviewId: string, dimension: string, rating: number, note: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_competency_rating", {
    target_review_id: reviewId,
    p_dimension: dimension,
    p_rating: rating,
    p_note: note.trim() || null,
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

  // Prefer an open cycle; otherwise the most recently created one.
  const sorted = [...reviews].sort((a, b) => {
    const aOpen = a.performance_review_cycles.status === "open" ? 1 : 0;
    const bOpen = b.performance_review_cycles.status === "open" ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return b.performance_review_cycles.created_at.localeCompare(a.performance_review_cycles.created_at);
  });
  const { performance_review_cycles: cycle, ...review } = sorted[0];

  const [{ data: self }, { data: manager }, { data: goals }, { data: competencyRatings }, pastGoals, { data: profile }] = await Promise.all([
    supabase.from("performance_review_self_assessments").select("*").eq("review_id", review.id).maybeSingle<SelfAssessment>(),
    supabase.from("performance_review_manager_assessments").select("*").eq("review_id", review.id).maybeSingle<ManagerAssessment>(),
    supabase.from("performance_review_goals").select("*").eq("review_id", review.id).order("created_at").returns<ReviewGoal[]>(),
    supabase.from("performance_review_competency_ratings").select("*").eq("review_id", review.id).returns<CompetencyRating[]>(),
    fetchPastGoals(supabase, review.id),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle<{ full_name: string | null; email: string }>(),
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
    },
  };
}

export async function submitSelfAssessment(reviewId: string, rating: number, reflection: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_self_assessment", {
    target_review_id: reviewId,
    p_rating: rating,
    p_reflection: reflection.trim(),
  });
  if (error) {
    console.error("submitSelfAssessment failed:", error);
    return { error: "Could not save — try again." };
  }
  revalidatePath("/dashboard/impact-cycle");
  return { success: true };
}

export async function acknowledgeReview(reviewId: string, comment: string) {
  const supabase = await createClient();
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
