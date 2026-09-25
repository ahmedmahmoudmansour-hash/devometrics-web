import { NextResponse } from "next/server";
import { buildXlsxResponse } from "@/lib/export/xlsx";
import { getKnowledgeHubContentReport } from "@/lib/knowledgeHub/actions";

// Per-content completion roster — the export button on a single Knowledge
// Hub item's admin detail page. Distinct from /api/company/export/
// score-history/xlsx (org-wide, one row per score_events row, scored
// content only): this is one row per ASSIGNED PERSON for ONE piece of
// content, and includes attestation-only completions (no score at all),
// which never produce a score_events row in the first place.
export async function GET(_request: Request, { params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params;

  // getKnowledgeHubContentReport already gates on isOrgAdmin internally and
  // degrades to an empty report rather than throwing — content===null
  // covers both "not found" and "not authorized" the same way the detail
  // page itself does.
  const report = await getKnowledgeHubContentReport(contentId);
  if (!report.content) {
    return NextResponse.json({ error: "Not authorized, or this content doesn't exist" }, { status: 403 });
  }

  const sheetRows = report.rows.map((r) => ({
    Name: r.name,
    Email: r.email,
    Status: r.status === "completed" ? "Completed" : "Not started",
    "Completed At": r.completedAt ?? "",
    Score: r.scorePercent !== null ? r.scorePercent : "",
    Passed: r.passed === null ? "" : r.passed ? "Yes" : "No",
    "Exam Attempts": r.examAttempts || "",
  }));

  return buildXlsxResponse(
    [{ name: "Completions", rows: sheetRows, colWidths: [24, 28, 14, 22, 8, 8, 12] }],
    `${report.content.title}-completions`
  );
}
