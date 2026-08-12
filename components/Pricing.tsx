"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ASSESSMENTS } from "@/lib/assessments/catalog";
import { ENTERPRISE_MIN_SEATS, type PricingRegion } from "@/lib/billing/pricingTiers";

// Translated function names (t) aren't stable identifiers to branch logic
// on, so plans carry their own ctaType instead of the old
// `plan.cta === "Contact sales"` string comparison, which was already dead
// code before this file had any translation (no plan ever set cta to that
// literal) — preserved as dead, just no longer keyed off display text.
type Plan = {
  name: string;
  price: { monthly: number | null; annual: number | null };
  originalPrice: { monthly: number | null; annual: number | null };
  perSeat: boolean;
  description: string;
  features: string[];
  cta: string;
  ctaType: "signup" | "contact";
  ctaStyle: "outline" | "filled";
  popular: boolean;
};

// initialRegion is threaded through from app/page.tsx's geo-IP lookup and
// kept as a real prop (not deleted) even though no branch here reads it
// right now — region-based $ figures are paused while pricing is decided
// directly per deal (see the price: null on Premium/Enterprise below), not
// removed, so turning real numbers back on later is a data change here,
// not a call-site change in app/page.tsx.
export default function Pricing({ initialRegion: _initialRegion }: { initialRegion: PricingRegion }) {
  const t = useTranslations("pricing");

  function buildPlans(): Plan[] {
    return [
      {
        name: t("planFreeName"),
        price: { monthly: 0, annual: 0 },
        originalPrice: { monthly: null, annual: null },
        perSeat: false,
        description: t("planFreeDescription"),
        features: [
          t("planFreeFeature1"),
          t("planFreeFeature2"),
          t("planFreeFeature3"),
          t("planFreeFeature4"),
          t("planFreeFeature5"),
        ],
        cta: t("planFreeCta"),
        ctaType: "signup",
        ctaStyle: "outline",
        popular: false,
      },
      {
        // No $ figure shown for now — pricing is set directly per deal
        // rather than published, so this always renders the "Custom"
        // branch below (plan.price.monthly === null) regardless of region
        // or promo state.
        name: t("planPremiumName"),
        price: { monthly: null, annual: null },
        originalPrice: { monthly: null, annual: null },
        perSeat: false,
        description: t("planPremiumDescription"),
        features: [
          t("planPremiumFeature1"),
          t("planPremiumFeature2"),
          t("planPremiumFeature3"),
          t("planPremiumFeature4"),
          t("planPremiumFeature5", { count: ASSESSMENTS.length }),
          t("planPremiumFeature6"),
          t("planPremiumFeature7"),
          t("planPremiumFeature8"),
          t("planPremiumFeature9"),
          t("planPremiumFeature10"),
        ],
        cta: t("planPremiumCta"),
        ctaType: "contact",
        ctaStyle: "filled",
        popular: true,
      },
      {
        // Same as Premium above — was a real per-seat $ figure
        // (ENTERPRISE_PRICING[region]), now always "Custom" until pricing
        // is public again.
        name: t("planEnterpriseName"),
        price: { monthly: null, annual: null },
        originalPrice: { monthly: null, annual: null },
        perSeat: false,
        description: t("planEnterpriseDescription"),
        features: [
          t("planEnterpriseFeature1"),
          t("planEnterpriseFeature2"),
          t("planEnterpriseFeature3"),
          t("planEnterpriseFeature4"),
          t("planEnterpriseFeature5"),
          t("planEnterpriseFeature6"),
          t("planEnterpriseFeature7"),
          t("planEnterpriseFeature8"),
          t("planEnterpriseFeature9"),
        ],
        cta: t("planEnterpriseCta"),
        ctaType: "contact",
        ctaStyle: "filled",
        popular: false,
      },
    ];
  }

  const plans = buildPlans();

  return (
    <section
      id="pricing"
      style={{
        padding: "100px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--teal)",
            textTransform: "uppercase",
          }}
        >
          {t("label")}
        </span>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginTop: 12,
            color: "var(--text)",
          }}
        >
          {t("headline")}
        </h2>
        <p style={{ fontSize: 17, color: "var(--text-muted)", marginTop: 16, lineHeight: 1.7 }}>
          {t("subtext")}
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--teal)",
            marginTop: 12,
            maxWidth: 480,
            marginInlineStart: "auto",
            marginInlineEnd: "auto",
            lineHeight: 1.6,
          }}
        >
          {t("pilotNote")}
        </p>

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          {t("studentNoteContactSales")}{" "}
          <a href="mailto:sales@devometrics.com" style={{ color: "var(--teal)" }}>
            sales@devometrics.com
          </a>
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: plan.popular ? "linear-gradient(160deg, rgba(var(--teal-rgb),0.08) 0%, var(--navy-mid) 40%)" : "var(--navy-mid)",
              border: plan.popular ? "1px solid rgba(var(--teal-rgb),0.35)" : "1px solid var(--border)",
              borderRadius: 20,
              padding: "36px 32px",
              position: "relative",
              boxShadow: plan.popular ? "0 0 60px rgba(var(--teal-rgb),0.06)" : "none",
            }}
          >
            {plan.popular && (
              <div
                style={{
                  position: "absolute",
                  insetBlockStart: -12,
                  insetInlineStart: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--teal)",
                  color: "#0A0F1E",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  padding: "4px 16px",
                  borderRadius: 100,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {t("mostPopular")}
              </div>
            )}

            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {plan.name}
              </span>
            </div>

            <div style={{ marginBottom: 8 }}>
              {plan.perSeat ? (
                <>
                  <span className="mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--text)" }}>
                    ${plan.price.monthly}
                    <span style={{ fontSize: 15, fontWeight: 400, color: "var(--text-muted)" }}>{t("perEmployeeMo")}</span>
                  </span>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {t("billedAnnually", { min: ENTERPRISE_MIN_SEATS })}
                  </p>
                </>
              ) : plan.price.monthly === null ? (
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>{t("custom")}</span>
              ) : (
                // Only Free (0) reaches here now that Premium/Enterprise
                // are always null above — a real nonzero price branch
                // (with the annual/monthly toggle + promo pricing) existed
                // here before pricing was hidden; see git history to
                // restore it once prices go public again.
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>{t("free")}</span>
              )}
            </div>

            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 28, lineHeight: 1.6 }}>
              {plan.description}
            </p>

            {plan.ctaType === "contact" ? (
              <Link
                href="/contact?type=sales"
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  transition: "all 0.2s",
                  marginBottom: 28,
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  textAlign: "center",
                  display: "block",
                }}
              >
                {plan.cta}
              </Link>
            ) : (
              <Link
                href="/signup"
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  transition: "all 0.2s",
                  marginBottom: 28,
                  textDecoration: "none",
                  textAlign: "center",
                  display: "block",
                  ...(plan.ctaStyle === "filled"
                    ? { background: "var(--teal)", color: "#0A0F1E", border: "none" }
                    : { background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }),
                }}
              >
                {plan.cta}
              </Link>
            )}

            {plan.perSeat && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: -18, marginBottom: 26 }}>
                {t("fiftyEmployees")}{" "}
                <Link href="/contact?type=sales" style={{ color: "var(--teal)", textDecoration: "none" }}>
                  {t("talkToSales")}
                </Link>{" "}
                {t("aboutCustomTerms")}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {plan.features.map((f) => (
                <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M3 8l4 4 6-7" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* How Enterprise scales — the org-size bands from the AI routing/cost
          doc (Starter/Growth/Enterprise/Enterprise Plus/Strategic). Shown as
          a table, not separate pricing cards, since none of these bands have
          real self-serve checkout wired up yet — every row still routes to
          "Talk to sales", same as the Enterprise card above it. The AI
          credit column is the same monthly_ai_budget_usd safety cap the
          admin dashboard already lets us raise per org, not a price. */}
      <div style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span
            className="mono"
            style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}
          >
            {t("scalingLabel")}
          </span>
          <h3
            className="font-display"
            style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", fontWeight: 700, letterSpacing: "-0.01em", marginTop: 8, color: "var(--text)" }}
          >
            {t("scalingHeadline")}
          </h3>
          <p style={{ fontSize: 14.5, color: "var(--text-muted)", marginTop: 10, maxWidth: 640, marginInlineStart: "auto", marginInlineEnd: "auto", lineHeight: 1.7 }}>
            {t("scalingSubtext")}
          </p>
        </div>

        {/* Card grid, not a table — a 4-column table forced ~570px of
            content into a ~326px mobile viewport, which meant scrolling
            sideways to read a row (worse in RTL, where the scroll direction
            itself is disorienting). auto-fit + minmax naturally stacks to
            one column on narrow screens with zero horizontal scroll. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              style={{
                background: "var(--navy-mid)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "18px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t(`scalingTier${n}Name`)}</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{t(`scalingTier${n}Size`)}</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>{t(`scalingTier${n}Adds`)}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 16 }}>
          {t("fiftyEmployees")}{" "}
          <Link href="/contact?type=sales" style={{ color: "var(--teal)", textDecoration: "none" }}>
            {t("talkToSales")}
          </Link>{" "}
          {t("aboutCustomTerms")}
        </p>
      </div>

      {/* Coming soon — deliberately vague on timing, no dates or commitments.
          Framed as Premium/Enterprise since these are ongoing-value features
          meant to reinforce the subscription, not one-shot tools. */}
      <div
        style={{
          marginTop: 48,
          padding: "28px 32px",
          borderRadius: 16,
          border: "1px dashed var(--border)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
          {t("inActiveDevelopment")}
        </span>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.7, maxWidth: 640, marginInlineStart: "auto", marginInlineEnd: "auto" }}>
          {t("comingSoonDescription")}
        </p>
      </div>
    </section>
  );
}
