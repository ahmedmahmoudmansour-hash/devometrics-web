import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { getSurveyResults } from "@/lib/surveys/actions";

// Deliberately NOT one row per respondent. Unlike Exit Interviews (which
// are name-identified by design) or Appraisal/Knowledge Hub rosters,
// survey answers are anonymized at the database layer before this app ever
// sees them — aggregateSurveyResponses' own header comment: "Pure
// computation over already-anonymized answer blobs (no user_id ever
// present)". Exporting a per-respondent table isn't just a design
// choice this route is skipping — the underlying data to build one
// doesn't exist here at all, and reconstructing per-respondent rows would
// mean undoing a deliberate privacy guarantee (this matters most for
// sensitive themes like Psychological Safety). This export mirrors
// exactly what SurveyResultsCard already shows on screen: a per-question
// summary, plus the anonymous open-ended responses on their own sheet
// (each is its own row rather than crammed into one cell — much more
// usable in Excel, and still carries no respondent linkage).
export async function GET(_request: Request, { params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;

  const company = await buildCompanyData();
  if (!company.isOrgAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const results = await getSurveyResults(surveyId);
  if ("error" in results) {
    return NextResponse.json({ error: results.error }, { status: 404 });
  }
  if (results.status === "insufficient_data") {
    return NextResponse.json({ error: "Not enough responses yet to export results." }, { status: 400 });
  }

  const summaryRows = results.aggregates.map((a) => ({
    Question: a.text,
    Type: a.type === "rating" ? "Rating (1-5)" : a.type === "multiple_choice" ? "Multiple choice" : "Open-ended",
    Responses: a.count,
    Result:
      a.type === "rating"
        ? a.count > 0
          ? `${a.average} average`
          : ""
        : a.type === "multiple_choice"
          ? Object.entries(a.optionCounts)
              .map(([option, count]) => `${option}: ${count}`)
              .join(", ")
          : "See Open-Ended Responses sheet",
  }));

  const openEndedRows = results.aggregates
    .filter((a) => a.type === "qualitative")
    .flatMap((a) => a.responses.map((response) => ({ Question: a.text, Response: response })));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 44 }, { wch: 16 }, { wch: 11 }, { wch: 50 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  if (openEndedRows.length > 0) {
    const openEndedSheet = XLSX.utils.json_to_sheet(openEndedRows);
    openEndedSheet["!cols"] = [{ wch: 44 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, openEndedSheet, "Open-Ended Responses");
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const safeTitle = results.title.replace(/[^a-zA-Z0-9._-]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeTitle}-results-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
