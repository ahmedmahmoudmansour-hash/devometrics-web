"use client";

import { useState } from "react";
import Link from "next/link";
import { ASSESSMENTS } from "@/lib/assessments/catalog";
import {
  PRICING,
  STUDENT_DISCOUNT,
  PROMO_DISCOUNT,
  PROMO_END_DATE,
  ENTERPRISE_PRICING,
  ENTERPRISE_MIN_SEATS,
  isPromoActive,
  promoPrice,
  type PricingRegion,
} from "@/lib/billing/pricingTiers";

function discountPercent(region: PricingRegion): number {
  const { monthly, annual } = PRICING[region];
  return Math.round((1 - annual / (monthly * 12)) * 100);
}

const PROMO_END_LABEL = PROMO_END_DATE.toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function buildPlans(region: PricingRegion) {
  const promoActive = isPromoActive();
  const premiumMonthly = promoActive ? promoPrice(region, "monthly") : PRICING[region].monthly;
  const premiumAnnual = promoActive ? promoPrice(region, "annual") : PRICING[region].annual;
  const originalMonthly = promoActive ? PRICING[region].monthly : null;
  const originalAnnual = promoActive ? PRICING[region].annual : null;

  return [
    {
      name: "Free",
      price: { monthly: 0, annual: 0 },
      originalPrice: { monthly: null as number | null, annual: null as number | null },
      perSeat: false,
      description: "Start mapping your career today.",
      features: [
        "Basic competency profile",
        "AI Discovery interview",
        "Career Health Score",
        "Limited AI coaching (10 messages/mo)",
        "30-day, generic development plan",
      ],
      cta: "Get started free",
      ctaStyle: "outline",
      popular: false,
    },
    {
      name: "Premium",
      price: { monthly: premiumMonthly, annual: premiumAnnual },
      originalPrice: { monthly: originalMonthly, annual: originalAnnual },
      perSeat: false,
      description: "The full gap analysis and development engine.",
      features: [
        "Everything in Free",
        "Unlimited AI coaching",
        "Full competency gap analysis",
        "CV + job description + target role analysis",
        `All ${ASSESSMENTS.length} assessments`,
        "90-day / 12-month / 3-year plans",
        "Named resources & specific guidance per milestone",
        "Resume Intelligence",
        "Interview Simulator (text + voice)",
        "Priority support",
      ],
      cta: "Try it now",
      ctaStyle: "filled",
      popular: true,
    },
    {
      name: "Enterprise",
      price: { monthly: ENTERPRISE_PRICING[region], annual: null },
      originalPrice: { monthly: null as number | null, annual: null as number | null },
      perSeat: true,
      description: "Workforce intelligence for teams and organizations.",
      features: [
        "Everything in Premium",
        "HR dashboard with full employee records",
        "Workforce skill inventory & talent heatmap",
        "Leadership readiness signal",
        "Custom competency framework builder",
        "Anonymous culture & pulse surveys",
        "Executive-level assessments",
        "Bulk employee import + Excel export",
        "Fully isolated company data",
      ],
      cta: "Set up your company workspace",
      ctaStyle: "filled",
      popular: false,
    },
  ];
}

export default function Pricing({ initialRegion }: { initialRegion: PricingRegion }) {
  const [annual, setAnnual] = useState(true);
  const region = initialRegion;

  const plans = buildPlans(region);
  const savePercent = discountPercent(region);

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
          Pricing
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
          Invest in the gap that matters
        </h2>
        <p style={{ fontSize: 17, color: "var(--text-muted)", marginTop: 16, lineHeight: 1.7 }}>
          One salary-band improvement pays for decades of Devometrics.
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--teal)",
            marginTop: 12,
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.6,
          }}
        >
          Pilot phase: every account gets full Premium access right now, free — the tiers below are
          what launches after the pilot.
        </p>

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          Pricing shown reflects your region automatically.{" "}
          <a href="mailto:sales@devometrics.com" style={{ color: "var(--teal)" }}>
            Student? Email sales@devometrics.com
          </a>{" "}
          for a {Math.round(STUDENT_DISCOUNT * 100)}% discount.
        </p>

        {/* Monthly/Annual toggle */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 100,
            padding: "4px 4px 4px 16px",
          }}
        >
          <span style={{ fontSize: 14, color: annual ? "var(--text-muted)" : "var(--text)", fontWeight: 500 }}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            style={{
              width: 48,
              height: 28,
              background: "var(--navy-light)",
              border: "1px solid var(--border)",
              borderRadius: 100,
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: annual ? 22 : 3,
                width: 20,
                height: 20,
                background: "var(--teal)",
                borderRadius: "50%",
                transition: "left 0.2s ease",
              }}
            />
          </button>
          <span style={{ fontSize: 14, color: annual ? "var(--text)" : "var(--text-muted)", fontWeight: 500 }}>Annual</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--teal)",
              background: "rgba(0,201,167,0.1)",
              borderRadius: 100,
              padding: "4px 10px",
              marginRight: 4,
            }}
          >
            Save {savePercent}%
          </span>
        </div>
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
              background: plan.popular ? "linear-gradient(160deg, rgba(0,201,167,0.08) 0%, var(--navy-mid) 40%)" : "var(--navy-mid)",
              border: plan.popular ? "1px solid rgba(0,201,167,0.35)" : "1px solid var(--border)",
              borderRadius: 20,
              padding: "36px 32px",
              position: "relative",
              boxShadow: plan.popular ? "0 0 60px rgba(0,201,167,0.06)" : "none",
            }}
          >
            {plan.popular && (
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
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
                Most popular
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
                    <span style={{ fontSize: 15, fontWeight: 400, color: "var(--text-muted)" }}>/employee/mo</span>
                  </span>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Billed annually · {ENTERPRISE_MIN_SEATS}-employee minimum
                  </p>
                </>
              ) : plan.price.monthly === null ? (
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>Custom</span>
              ) : plan.price.monthly === 0 ? (
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>Free</span>
              ) : (
                <>
                  {(annual ? plan.originalPrice.annual : plan.originalPrice.monthly) !== null && (
                    <span className="mono" style={{ fontSize: 18, fontWeight: 400, color: "var(--text-muted)", textDecoration: "line-through", marginRight: 8 }}>
                      ${annual ? plan.originalPrice.annual : plan.originalPrice.monthly}
                    </span>
                  )}
                  <span className="mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--text)" }}>
                    ${annual ? plan.price.annual : plan.price.monthly}
                    <span style={{ fontSize: 15, fontWeight: 400, color: "var(--text-muted)" }}>
                      {annual ? "/yr" : "/mo"}
                    </span>
                  </span>
                  {(annual ? plan.originalPrice.annual : plan.originalPrice.monthly) !== null && (
                    <p style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700, marginTop: 4 }}>
                      {Math.round(PROMO_DISCOUNT * 100)}% off until {PROMO_END_LABEL}
                    </p>
                  )}
                </>
              )}
            </div>

            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 28, lineHeight: 1.6 }}>
              {plan.description}
            </p>

            {plan.cta === "Contact sales" ? (
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
                50+ employees?{" "}
                <Link href="/contact?type=sales" style={{ color: "var(--teal)", textDecoration: "none" }}>
                  Talk to sales
                </Link>{" "}
                about custom terms.
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
          In active development — Premium &amp; Enterprise
        </span>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.7, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
          Job recommendations matched to your profile, a fresh assessment every month, curated
          micro-learning, and peer learning communities — all in progress, rolling out over time.
        </p>
      </div>
    </section>
  );
}
