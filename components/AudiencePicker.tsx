import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { User, Building2, ArrowRight } from "lucide-react";

// Sits right below the Hero as a fork: two audiences, two routes. Individual
// stays on "/" and jumps into the tabbed content below (same interceptor
// HomeTabs already wires up for "/#how-it-works" links from the Navbar);
// Enterprise is a real route change to /enterprise. This replaces trying to
// make the enterprise page share the homepage's tab-bar chrome — one shared
// picker pattern at the fork point is simpler than forcing two differently-
// shaped pages (a short tabbed tour vs. a continuous sales narrative) to
// look identical end to end.
export default async function AudiencePicker() {
  const t = await getTranslations("common");

  const cards = [
    {
      href: "/#how-it-works",
      icon: User,
      title: t("audienceIndividualTitle"),
      description: t("audienceIndividualDescription"),
      cta: t("audienceIndividualCta"),
    },
    {
      href: "/enterprise",
      icon: Building2,
      title: t("audienceEnterpriseTitle"),
      description: t("audienceEnterpriseDescription"),
      cta: t("audienceEnterpriseCta"),
    },
  ];

  return (
    <section style={{ padding: "0 24px 80px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
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
          {t("audienceLabel")}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card-hover"
            style={{
              display: "block",
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 28,
              textDecoration: "none",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                borderRadius: 14,
                color: "var(--teal)",
                background: "rgba(var(--teal-rgb),0.1)",
                border: "1px solid rgba(var(--teal-rgb),0.2)",
                marginBottom: 18,
              }}
            >
              <card.icon size={24} />
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8, letterSpacing: "-0.01em" }}>
              {card.title}
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 18 }}>
              {card.description}
            </p>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--teal)",
              }}
            >
              {card.cta}
              <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
