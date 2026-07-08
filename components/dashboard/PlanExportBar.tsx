"use client";

export default function PlanExportBar({ planId, title }: { planId: string; title: string }) {
  return (
    <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
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
      <a
        href={`/api/plans/${planId}/export/docx`}
        download={`${title.replace(/[^a-z0-9]+/gi, "-")}.docx`}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text)",
          textDecoration: "none",
        }}
      >
        Download as Word
      </a>
    </div>
  );
}
