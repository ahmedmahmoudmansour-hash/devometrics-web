export default function UpgradeToPremiumCard() {
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
        Upgrade to Premium
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Full gap analysis, all assessments, longer plan horizons, and named resources per milestone.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href="/api/billing/checkout?cadence=monthly"
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Monthly
        </a>
        <a
          href="/api/billing/checkout?cadence=annual"
          style={{
            background: "transparent",
            color: "var(--teal)",
            border: "1px solid rgba(0,201,167,0.4)",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Annual — save more
        </a>
      </div>
    </div>
  );
}
