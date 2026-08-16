import { getTranslations } from "next-intl/server";
import Avatar from "@/components/Avatar";

export default async function EnterpriseSuccessionPage() {
  const t = await getTranslations("enterprisePage");

  return (
    <section id="succession" style={{ padding: "0 24px 100px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", color: "var(--teal)", textTransform: "uppercase" }}>
          {t("successionLabel")}
        </span>
        <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 12, color: "var(--text)" }}>
          {t("successionHeadline")}
        </h2>
        <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 16, maxWidth: 640, margin: "16px auto 0", lineHeight: 1.7 }}>
          {t("successionSubtext")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { name: "Priya Kapoor", fit: 68, reasoning: t("successionRank1Reasoning"), gap: t("successionRank1Gap") },
          { name: "Amara Osei", fit: 65, reasoning: t("successionRank2Reasoning"), gap: t("successionRank2Gap") },
          { name: "Daniel Mensah", fit: 44, reasoning: t("successionRank3Reasoning"), gap: t("successionRank3Gap") },
        ].map((c, i) => (
          <div
            key={c.name}
            style={{
              background: "var(--navy-mid)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "22px 26px",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              className="mono"
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 15,
                color: i === 0 ? "#0A0F1E" : "var(--text)",
                background: i === 0 ? "var(--teal)" : "rgba(255,255,255,0.06)",
                border: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              {i + 1}
            </div>
            <Avatar name={c.name} avatarUrl={null} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>
                  {t("successionFitLabel", { percent: c.fit })}
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 4 }}>{c.reasoning}</p>
              <p style={{ fontSize: 12.5, color: "var(--amber)", lineHeight: 1.6 }}>{c.gap}</p>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 24, maxWidth: 600, marginInline: "auto", lineHeight: 1.7 }}>
        {t("successionDisclaimer")}
      </p>
    </section>
  );
}
