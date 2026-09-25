import { NextResponse } from "next/server";
import { buildXlsxResponse } from "@/lib/export/xlsx";
import { listReviewCycles, listReviewsForCycle } from "@/lib/performanceReviews/actions";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  self_submitted: "Self-assessment submitted",
  manager_submitted: "Manager assessment submitted",
  acknowledged: "Acknowledged",
  closed: "Closed",
};

// Whole-cycle appraisal roster — the export button on the Impact Cycles
// admin page (PerformanceReviewsManager), scoped to whichever cycle is
// currently selected. Distinct from /api/company/export/score-history/xlsx
// (which only carries the numeric self/manager ratings once they land in
// score_events): this is the full per-review picture for one cycle,
// including status and both individual ratings side by side, matching what
// the admin already sees on screen for this cycle.
export async function GET(_request: Request, { params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;

  // Both calls are independently gated on isOrgAdmin (degrade to
  // []/{cycles:[]} rather than throwing) — the cycles list additionally
  // confirms this cycleId actually belongs to the caller's own org, since
  // listReviewsForCycle alone would just return an empty roster for a
  // cycleId from a different org rather than a clear 403.
  const [{ cycles }, reviews] = await Promise.all([listReviewCycles(), listReviewsForCycle(cycleId)]);
  const cycle = cycles.find((c) => c.id === cycleId);
  if (!cycle) {
    return NextResponse.json({ error: "Not authorized, or this cycle doesn't exist" }, { status: 403 });
  }

  const sheetRows = reviews.map((r) => ({
    Employee: r.employeeName,
    Email: r.employeeEmail,
    Status: STATUS_LABEL[r.status] ?? r.status,
    "Self Rating": r.selfRating ?? "",
    "Manager Rating": r.managerRating ?? "",
    "Acknowledged At": r.employee_acknowledged_at ?? "",
    Escalated: r.escalation_requested_at ? (r.escalation_resolved_at ? "Resolved" : "Open") : "",
  }));

  return buildXlsxResponse(
    [{ name: "Appraisal Roster", rows: sheetRows, colWidths: [24, 28, 26, 12, 14, 22, 10] }],
    `${cycle.name}-appraisal`
  );
}
