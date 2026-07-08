import type { SubscriptionTier } from "@/lib/billing/subscriptionTier";

// UI-level companion to the server-side tier checks in the underlying
// Server Actions/API routes (e.g. app/api/roleplay/route.ts,
// app/api/resume-intelligence/route.ts) — those are the actual security
// boundary. This just avoids showing a free user a form that would fail the
// moment they submitted it.
export default function PremiumGate({
  tier,
  feature,
  description,
  children,
}: {
  tier: SubscriptionTier;
  feature: string;
  description: string;
  children: React.ReactNode;
}) {
  if (tier !== "free") return <>{children}</>;

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>
        Premium feature
      </p>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{feature}</h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>{description}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href="/api/billing/checkout?cadence=monthly"
          style={{
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Upgrade — Monthly
        </a>
        <a
          href="/api/billing/checkout?cadence=annual"
          style={{
            background: "transparent",
            color: "var(--teal)",
            border: "1px solid rgba(0,201,167,0.4)",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
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
