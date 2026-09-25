import { NextResponse } from "next/server";
import { buildXlsxResponse } from "@/lib/export/xlsx";
import { buildCompanyData } from "@/lib/organizations/aggregate";

// Company-scoped counterpart to /api/admin/export/xlsx (which is the
// platform-wide pilot-cohort export) -- an org admin needs their own
// workforce data (incl. department/country) for their own HR reporting,
// not the cross-org pilot tracking sheet.
export async function GET() {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const sheetRows = data.rows.map((r) => ({
    Name: r.name,
    Title: r.title ?? "",
    Department: r.department ?? "",
    "Business Unit": r.businessUnit ?? "",
    Manager: r.managerName ?? "",
    "Manager Email": r.managerEmail ?? "",
    Country: r.country ?? "",
    Location: r.location ?? "",
    Email: r.email,
    "Career Health Score": r.careerHealthScore ?? "",
    "Assessments Completed": r.assessmentsCompleted,
    Plans: r.plans,
    "Milestones Done": r.milestonesDone,
    "Milestones Total": r.milestonesTotal,
  }));

  return buildXlsxResponse(
    [{ name: "Workforce", rows: sheetRows, colWidths: [22, 20, 18, 18, 20, 16, 16, 28, 18, 16, 8, 16, 16] }],
    `${data.organizationName ?? "devometrics"}-workforce`
  );
}
