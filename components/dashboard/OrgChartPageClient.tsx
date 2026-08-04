"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import OrgChartView from "@/components/dashboard/OrgChartView";
import OrgChartDepartmentView from "@/components/dashboard/OrgChartDepartmentView";
import type { WorkforceRow } from "@/lib/organizations/aggregate";
import type { OrgPositionRow } from "@/lib/orgChart/positions";

type ViewMode = "corporate" | "department";

export default function OrgChartPageClient({
  rows,
  nominatedUserIds,
  positions,
  memberManagerPositions,
}: {
  rows: WorkforceRow[];
  nominatedUserIds: string[];
  positions: OrgPositionRow[];
  memberManagerPositions: Record<string, string>;
}) {
  const t = useTranslations("orgChartPageClient");
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
      <div className="no-print" style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, marginBottom: 20, gap: 2 }}>
        <button type="button" onClick={() => setMode("corporate")} style={tabStyle(mode === "corporate")}>
          {t("corporateTab")}
        </button>
        <button type="button" onClick={() => setMode("department")} style={tabStyle(mode === "department")}>
          {t("departmentTab")}
        </button>
      </div>

      {mode === "corporate" ? (
        <OrgChartView rows={rows} nominatedUserIds={nominatedUserIds} positions={positions} memberManagerPositions={memberManagerPositions} />
      ) : (
        <OrgChartDepartmentView rows={rows} />
      )}
    </div>
  );
}
