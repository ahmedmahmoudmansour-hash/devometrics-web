// Groups the home dashboard's cards under a labeled heading instead of one
// long undifferentiated stack — same eyebrow-label style already used
// throughout the app (e.g. OnboardingChecklist, Pricing section labels).
// Server-component friendly: no hooks, no handlers.
export default function DashboardSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
    </div>
  );
}
