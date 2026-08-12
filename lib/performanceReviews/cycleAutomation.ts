import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AutomatedCycleStarterKey = "probation_review" | "mid_year_checkin";

// Thin wrapper over create_automated_review_cycle (migration 0122) — kept as
// a shared helper (not inlined at each call site) because it's called from
// two different automation contexts: runHireToProbation (lib/automations/
// recipes.ts, Part 4 — fires in the NEW EMPLOYEE's own session) and the
// mid-year trigger inside submitManagerAssessment (lib/performanceReviews/
// actions.ts, Part 5 — fires in the MANAGER's session, for someone else).
// The RPC itself authorizes both shapes internally (self-scoped OR
// org-admin OR the target's own manager) — this wrapper is not a second
// authorization layer, just a typed, error-normalized call site.
export async function createAutomatedSingleEmployeeCycle(
  supabase: SupabaseServerClient,
  params: { employeeUserId: string; starterKey: AutomatedCycleStarterKey; cycleName: string; opensAt?: string | null }
): Promise<{ success: true; reviewId: string } | { error: string }> {
  const { data, error } = await supabase.rpc("create_automated_review_cycle", {
    p_employee_user_id: params.employeeUserId,
    p_starter_key: params.starterKey,
    p_cycle_name: params.cycleName,
    p_opens_at: params.opensAt ?? null,
  });
  if (error || !data) {
    console.error("createAutomatedSingleEmployeeCycle failed:", error);
    return { error: "Could not create the review cycle — the database may need migration 0122 run first." };
  }
  return { success: true, reviewId: data as string };
}
