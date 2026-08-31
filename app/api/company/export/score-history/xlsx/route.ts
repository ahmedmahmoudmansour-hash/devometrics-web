import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { buildCompanyData } from "@/lib/organizations/aggregate";
import { createClient } from "@/lib/supabase/server";

// Score-history counterpart to /api/company/export/xlsx (the flat
// one-row-per-employee roster export) -- kept as its own route rather than
// extended into that one since the shape here is one row per score_events
// row, not per employee. Filters: department, manager (by manager's user
// id), role (job title, case-insensitive substring), date range, source,
// and a single employee. Every filter is optional and combinable.
export async function GET(request: NextRequest) {
  const data = await buildCompanyData();
  if (!data.isOrgAdmin || !data.organizationId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const department = params.get("department");
  const managerUserId = params.get("managerId");
  const roleFilter = params.get("role")?.toLowerCase() ?? null;
  const source = params.get("source");
  const employeeUserId = params.get("employeeUserId");
  const from = params.get("from"); // ISO date, inclusive
  const to = params.get("to"); // ISO date, inclusive

  const supabase = await createClient();
  let query = supabase
    .from("score_events")
    .select("employee_user_id, source, dimension, raw_value, scale, recorded_at")
    .eq("organization_id", data.organizationId)
    .order("recorded_at", { ascending: false });

  if (source) query = query.eq("source", source);
  if (employeeUserId) query = query.eq("employee_user_id", employeeUserId);
  if (from) query = query.gte("recorded_at", from);
  if (to) query = query.lte("recorded_at", to);

  const { data: events, error } = await query.returns<
    { employee_user_id: string; source: string; dimension: string; raw_value: number; scale: string; recorded_at: string }[]
  >();
  // A query error (most likely: migration 0147 hasn't been run yet) is
  // reported explicitly here rather than silently returning an empty file --
  // unlike a dashboard widget, an empty export a user can't tell apart from
  // "no data exists" is actively misleading.
  if (error) {
    return NextResponse.json({ error: "Could not read score history — the database may need migration 0147 run first." }, { status: 500 });
  }

  // Department/manager/role/name are looked up from the already-fetched
  // workforce roster rather than a second join against profiles.
  const rowByUser = new Map(data.rows.map((r) => [r.userId, r]));

  const sheetRows = (events ?? [])
    .filter((e) => {
      const employee = rowByUser.get(e.employee_user_id);
      if (!employee) return false; // archived/removed since — don't surface a row with no attributable name
      if (department && employee.department !== department) return false;
      if (managerUserId && employee.managerUserId !== managerUserId) return false;
      if (roleFilter && !(employee.title ?? "").toLowerCase().includes(roleFilter)) return false;
      return true;
    })
    .map((e) => {
      const employee = rowByUser.get(e.employee_user_id)!;
      return {
        Employee: employee.name,
        Department: employee.department ?? "",
        Manager: employee.managerName ?? "",
        Source: e.source,
        Dimension: e.dimension || "",
        Score: e.raw_value,
        Scale: e.scale,
        "Recorded At": e.recorded_at,
      };
    });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 26 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 22 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Score History");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${data.organizationName ?? "devometrics"}-score-history-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
