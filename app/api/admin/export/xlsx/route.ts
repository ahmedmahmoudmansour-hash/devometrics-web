import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { buildPilotRows } from "@/lib/admin/aggregate";

export async function GET() {
  const { isAdmin, rows } = await buildPilotRows();
  if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const sheetRows = rows.map((r) => ({
    Name: r.name,
    Email: r.email,
    "Career Health Score": r.careerHealthScore ?? "",
    "Assessments Completed": r.assessmentsCompleted,
    "Total Assessments": r.totalAssessments,
    Plans: r.plans,
    "Milestones Done": r.milestonesDone,
    "Milestones Total": r.milestonesTotal,
    Joined: new Date(r.joined).toLocaleDateString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pilot Cohort");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="devometrics-pilot-cohort-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
