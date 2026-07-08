import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
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
    Country: r.country ?? "",
    Email: r.email,
    "Career Health Score": r.careerHealthScore ?? "",
    "Assessments Completed": r.assessmentsCompleted,
    Plans: r.plans,
    "Milestones Done": r.milestonesDone,
    "Milestones Total": r.milestonesTotal,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 16 }, { wch: 16 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Workforce");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${data.organizationName ?? "devometrics"}-workforce-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
