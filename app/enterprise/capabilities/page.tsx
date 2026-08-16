import { getTranslations } from "next-intl/server";
import { CAPABILITY_ICONS } from "@/lib/enterprise/sampleWorkspace";

export default async function EnterpriseCapabilitiesPage() {
  const t = await getTranslations("enterprisePage");

  const capabilityTitles = [t("cap1Title"), t("cap2Title"), t("cap3Title"), t("cap4Title"), t("cap5Title"), t("cap6Title"), t("cap7Title"), t("cap8Title"), t("cap9Title"), t("cap10Title"), t("cap11Title"), t("cap12Title"), t("cap13Title"), t("cap14Title"), t("cap15Title")];
  const capabilityDescriptions = [t("cap1Description"), t("cap2Description"), t("cap3Description"), t("cap4Description"), t("cap5Description"), t("cap6Description"), t("cap7Description"), t("cap8Description"), t("cap9Description"), t("cap10Description"), t("cap11Description"), t("cap12Description"), t("cap13Description"), t("cap14Description"), t("cap15Description")];
  const capabilities = CAPABILITY_ICONS.map((icon, i) => ({
    title: capabilityTitles[i],
    description: capabilityDescriptions[i],
    icon,
  }));

  return (
    <section
      id="capabilities"
      style={{
        padding: "80px 24px",
        background: "var(--navy-mid)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
            {t("capabilitiesLabel")}
          </span>
          <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 12, color: "var(--text)" }}>
            {t("capabilitiesHeadline")}
          </h2>
        </div>
        {/* Hairline-divider grid (Zoho-suite structure, dark-theme
            translation): the 1px gap over a border-colored background
            paints clean internal gridlines at any column count, with a
            single rounded, clipped outer frame — no floating cards. No
            per-cell CTA on purpose: these are features of one product,
            not separate apps to "try" individually. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 1,
            background: "var(--border)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {capabilities.map((c) => (
            <div key={c.title} style={{ background: "var(--navy)", padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
                  {c.title}
                </h3>
                <span
                  style={{
                    flexShrink: 0,
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--teal)",
                    background: "rgba(var(--teal-rgb),0.1)",
                    border: "1px solid rgba(var(--teal-rgb),0.2)",
                  }}
                >
                  <c.icon size={18} />
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>{c.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
