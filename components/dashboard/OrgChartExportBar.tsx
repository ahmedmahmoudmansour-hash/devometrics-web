"use client";

import { useTranslations } from "next-intl";

// Same window.print() + .no-print pattern already used identically by
// EmployeeReportExportBar/PlanExportBar/BridgeContentView — no PDF-
// generation library, this app's established house style for this need.
export default function OrgChartExportBar() {
  const t = useTranslations("orgChartExportBar");
  return (
    <div className="no-print" style={{ display: "inline-block" }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        {t("downloadPdf")}
      </button>
    </div>
  );
}
