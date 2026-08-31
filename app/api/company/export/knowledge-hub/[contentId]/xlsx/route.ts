import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
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

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Completions");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const safeTitle = report.content.title.replace(/[^a-zA-Z0-9._-]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeTitle}-completions-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
