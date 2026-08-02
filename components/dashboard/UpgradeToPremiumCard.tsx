import Link from "next/link";
import { useTranslations } from "next-intl";

export default function UpgradeToPremiumCard() {
  const t = useTranslations("upgradeToPremiumCard");
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
        {t("title")}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        {t("subtitle")}
      </p>
      <Link
        href="/contact?type=sales"
        style={{
          display: "inline-block",
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
        {t("contactToUpgrade")}
      </Link>
    </div>
  );
}
