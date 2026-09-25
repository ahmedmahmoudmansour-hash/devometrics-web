import { NextResponse } from "next/server";
import { buildXlsxResponse } from "@/lib/export/xlsx";
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

  return buildXlsxResponse(
    [{ name: "Pilot Cohort", rows: sheetRows, colWidths: [22, 28, 18, 18, 16, 8, 16, 16, 12] }],
    "devometrics-pilot-cohort"
  );
}
