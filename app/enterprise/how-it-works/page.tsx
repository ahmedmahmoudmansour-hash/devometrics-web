import { getTranslations } from "next-intl/server";

export default async function EnterpriseHowItWorksPage() {
  const t = await getTranslations("enterprisePage");

  const steps = [
    { n: "1", title: t("step1Title"), description: t("step1Description") },
    { n: "2", title: t("step2Title"), description: t("step2Description") },
    { n: "3", title: t("step3Title"), description: t("step3Description") },
  ];

  return (
    <section id="how-it-works" style={{ padding: "100px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
          {t("howItWorksLabel")}
        </span>
        <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 12, color: "var(--text)" }}>
          {t("howItWorksHeadline")}
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {steps.map((s) => (
          <div key={s.n} style={{ textAlign: "center" }}>
            <div
              className="mono"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(var(--teal-rgb),0.1)",
                border: "1px solid rgba(var(--teal-rgb),0.3)",
                color: "var(--teal)",
                fontWeight: 600,
                fontSize: 17,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              {s.n}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{s.title}</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
