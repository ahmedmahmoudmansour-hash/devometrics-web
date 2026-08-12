// Groups the home dashboard's cards under a labeled heading instead of one
// long undifferentiated stack — same eyebrow-label style already used
// throughout the app (e.g. OnboardingChecklist, Pricing section labels).
// Server-component friendly: no hooks, no handlers. `collapsible` uses the
// native <details>/<summary> disclosure instead of client-side state, so a
// section can default closed (2026-08 UX audit's "content tiering" fix —
// splitting "things that change" from "things you check less often") with
// zero JS shipped for it.
export default function DashboardSection({
  label,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  };

  if (!collapsible) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={labelStyle}>{label}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
      </div>
    );
  }

  return (
    <details open={defaultOpen} className="dashboard-section-details">
      <summary style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", listStyle: "none" }}>
        {label}
        <svg className="dashboard-section-chevron" width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>{children}</div>
      <style>{`
        .dashboard-section-details > summary::-webkit-details-marker { display: none; }
        .dashboard-section-chevron { transition: transform 0.15s ease; }
        .dashboard-section-details[open] .dashboard-section-chevron { transform: rotate(180deg); }
      `}</style>
    </details>
  );
}
