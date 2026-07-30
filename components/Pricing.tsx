"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
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

export default function Pricing({ initialRegion }: { initialRegion: PricingRegion }) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const [annual, setAnnual] = useState(true);
  const region = initialRegion;

  const dateLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  const promoEndLabel = PROMO_END_DATE.toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function buildPlans(): Plan[] {
    const promoActive = isPromoActive();
    const premiumMonthly = promoActive ? promoPrice(region, "monthly") : PRICING[region].monthly;
    const premiumAnnual = promoActive ? promoPrice(region, "annual") : PRICING[region].annual;
    const originalMonthly = promoActive ? PRICING[region].monthly : null;
    const originalAnnual = promoActive ? PRICING[region].annual : null;

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
        name: t("planPremiumName"),
        price: { monthly: premiumMonthly, annual: premiumAnnual },
        originalPrice: { monthly: originalMonthly, annual: originalAnnual },
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
        ctaType: "signup",
        ctaStyle: "filled",
        popular: true,
      },
      {
        name: t("planEnterpriseName"),
        price: { monthly: ENTERPRISE_PRICING[region], annual: null },
        originalPrice: { monthly: null, annual: null },
        perSeat: true,
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
        ctaType: "signup",
        ctaStyle: "filled",
        popular: false,
      },
    ];
  }

  const plans = buildPlans();
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
          {t("regionNote")}{" "}
          <a href="mailto:sales@devometrics.com" style={{ color: "var(--teal)" }}>
            {t("studentNote")}
          </a>{" "}
          {t("studentDiscount", { percent: Math.round(STUDENT_DISCOUNT * 100) })}
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
            paddingInlineStart: 16,
            paddingInlineEnd: 4,
            paddingBlock: 4,
          }}
        >
          <span style={{ fontSize: 14, color: annual ? "var(--text-muted)" : "var(--text)", fontWeight: 500 }}>{t("monthly")}</span>
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
                insetBlockStart: 3,
                insetInlineStart: annual ? 22 : 3,
                width: 20,
                height: 20,
                background: "var(--teal)",
                borderRadius: "50%",
                transition: "inset-inline-start 0.2s ease",
              }}
            />
          </button>
          <span style={{ fontSize: 14, color: annual ? "var(--text)" : "var(--text-muted)", fontWeight: 500 }}>{t("annual")}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--teal)",
              background: "rgba(0,201,167,0.1)",
              borderRadius: 100,
              padding: "4px 10px",
              marginInlineEnd: 4,
            }}
          >
            {t("savePercent", { percent: savePercent })}
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
              ) : plan.price.monthly === 0 ? (
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>{t("free")}</span>
              ) : (
                <>
                  {(annual ? plan.originalPrice.annual : plan.originalPrice.monthly) !== null && (
                    <span className="mono" style={{ fontSize: 18, fontWeight: 400, color: "var(--text-muted)", textDecoration: "line-through", marginInlineEnd: 8 }}>
                      ${annual ? plan.originalPrice.annual : plan.originalPrice.monthly}
                    </span>
                  )}
                  <span className="mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--text)" }}>
                    ${annual ? plan.price.annual : plan.price.monthly}
                    <span style={{ fontSize: 15, fontWeight: 400, color: "var(--text-muted)" }}>
                      {annual ? t("perYear") : t("perMonth")}
                    </span>
                  </span>
                  {(annual ? plan.originalPrice.annual : plan.originalPrice.monthly) !== null && (
                    <p style={{ fontSize: 11, color: "var(--teal)", fontWeight: 700, marginTop: 4 }}>
                      {t("offUntil", { percent: Math.round(PROMO_DISCOUNT * 100), date: promoEndLabel })}
                    </p>
                  )}
                </>
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

        <div
          style={{
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr>
                  {[t("scalingTierHeader"), t("scalingSizeHeader"), t("scalingCreditHeader"), t("scalingAddsHeader")].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 18px",
                        textAlign: "start",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((n) => (
                  <tr key={n}>
                    <td style={{ padding: "12px 18px", fontWeight: 700, color: "var(--text)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {t(`scalingTier${n}Name`)}
                    </td>
                    <td style={{ padding: "12px 18px", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {t(`scalingTier${n}Size`)}
                    </td>
                    <td className="mono" style={{ padding: "12px 18px", color: "var(--teal)", fontWeight: 700, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {t(`scalingTier${n}Credit`)}
                    </td>
                    <td style={{ padding: "12px 18px", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", lineHeight: 1.6 }}>
                      {t(`scalingTier${n}Adds`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
