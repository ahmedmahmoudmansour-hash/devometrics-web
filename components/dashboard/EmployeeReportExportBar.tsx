"use client";

export default function EmployeeReportExportBar() {
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
        Download as PDF
      </button>
    </div>
  );
}
