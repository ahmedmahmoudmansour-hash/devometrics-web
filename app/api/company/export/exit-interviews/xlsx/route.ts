import { NextResponse } from "next/server";
import { buildXlsxResponse } from "@/lib/export/xlsx";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { listExitInterviews } from "@/lib/exitInterviews/actions";
import { EXIT_INTERVIEW_QUESTIONS } from "@/lib/exitInterviews/questions";

const SEPARATION_LABEL: Record<string, string> = {
  voluntary: "Voluntary",
  involuntary: "Involuntary",
  other: "Other",
};

// One column per question, not one row per response — unlike Surveys,
// every exit interview in an org answers the exact same fixed
// EXIT_INTERVIEW_QUESTIONS list (see that file's header comment), so a
// wide table where each row is one departed employee and each question is
// its own column is directly comparable/filterable across the whole
// roster, which is what this export is for. Exit interviews are
// name-identified by design (unlike surveys — see the export/surveys
// route's header comment for why that one is deliberately NOT
// identified), so no anonymity concern here.
export async function GET() {
  const company = await buildCompanyData();
  if (!company.isOrgAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const interviews = await listExitInterviews();

  const sheetRows = interviews.map((interview) => {
    const row: Record<string, string> = {
      "Employee Name": interview.employee_name,
      Department: interview.department ?? "",
      Title: interview.title ?? "",
      Manager: interview.manager_name ?? "",
      "Last Day": interview.last_day ?? "",
      "Separation Type": SEPARATION_LABEL[interview.separation_type] ?? interview.separation_type,
    };
    // Answers are stored parallel to EXIT_INTERVIEW_QUESTIONS by position
    // (see ExitInterview.responses' own type), not by a stable question
    // key — indexing into the fixed list here is what keeps every row's
    // columns aligned to the same question regardless of row order.
    EXIT_INTERVIEW_QUESTIONS.forEach((question, i) => {
      row[question] = interview.responses[i]?.answer ?? "";
    });
    row["Additional Notes"] = interview.additional_notes ?? "";
    row["Recorded At"] = interview.created_at;
    return row;
  });

  return buildXlsxResponse(
    [
      {
        name: "Exit Interviews",
        rows: sheetRows,
        colWidths: [22, 16, 20, 20, 12, 14, ...EXIT_INTERVIEW_QUESTIONS.map(() => 40), 40, 22],
      },
    ],
    "exit-interviews"
  );
}
