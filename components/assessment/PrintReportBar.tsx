"use client";

import { useTranslations } from "next-intl";

// "Print or save as PDF" for an assessment result. Same window.print() + .no-print + .print-plan approach as the employee report
// and development plan, so the browser's print dialog offers Save as PDF and the page prints as a clean light document.
export default function PrintReportBar() {
  const t = useTranslations("assessmentReport");
  return (
    <div className="no-print" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        {t("print")}
      </button>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("printHint")}</span>
    </div>
  );
}
