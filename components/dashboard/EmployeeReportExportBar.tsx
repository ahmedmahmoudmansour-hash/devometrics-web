"use client";

import { useTranslations } from "next-intl";

export default function EmployeeReportExportBar() {
  const t = useTranslations("employeeReportExportBar");
  return (
    <div className="no-print" style={{ marginBottom: 24 }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          background: "var(--teal)",
          color: "#0A0F1E",
          border: "none",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {t("downloadPdf")}
      </button>
    </div>
  );
}
