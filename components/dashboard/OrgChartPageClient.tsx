"use client";

import { useState } from "react";
import OrgChartView from "@/components/dashboard/OrgChartView";
import OrgChartDepartmentView from "@/components/dashboard/OrgChartDepartmentView";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

type ViewMode = "corporate" | "department";

export default function OrgChartPageClient({ rows }: { rows: WorkforceRow[] }) {
  const [mode, setMode] = useState<ViewMode>("corporate");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--teal)" : "transparent",
    color: active ? "#0A0F1E" : "var(--text-muted)",
    border: "none",
    borderRadius: 6,
    padding: "7px 16px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div>
      <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, marginBottom: 20, gap: 2 }}>
        <button type="button" onClick={() => setMode("corporate")} style={tabStyle(mode === "corporate")}>
          Corporate (reporting lines)
        </button>
        <button type="button" onClick={() => setMode("department")} style={tabStyle(mode === "department")}>
          Function / Department
        </button>
      </div>

      {mode === "corporate" ? <OrgChartView rows={rows} /> : <OrgChartDepartmentView rows={rows} />}
    </div>
  );
}
