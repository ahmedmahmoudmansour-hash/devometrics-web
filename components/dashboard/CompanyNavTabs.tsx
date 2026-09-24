import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { COMPANY_TILES, type CompanyFeatureKey } from "@/lib/organizations/companyTiles";
import { getMyDisabledCompanyFeatures } from "@/lib/organizations/companyFeatures";

type TabKey = CompanyFeatureKey;

// Two tiers, sharing one taxonomy with the company hub tiles and the admin
// "Tiles & features" switches (lib/organizations/companyTiles.ts): the six
// group labels always show (each a real link to that group's first
// feature), and only the CURRENT group's own features expand below them.
// Zero client JS — which group is open is derived from `active`. Features
// an admin has switched off (0179) are left out, and a group with nothing
// left disappears.
export default async function CompanyNavTabs({ active }: { active: TabKey }) {
  const t = await getTranslations("companyNavTabs");
  const disabled = new Set(await getMyDisabledCompanyFeatures());

  const groups = COMPANY_TILES.map((tile) => ({
    key: tile.key,
    features: tile.features.filter((f) => !disabled.has(f.key) || f.key === active),
  })).filter((g) => g.features.length > 0);

  const activeGroup = groups.find((g) => g.features.some((f) => f.key === active)) ?? groups[0];

  return (
    <div style={{ marginBottom: 24, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {groups.map((group) => {
          const isActiveGroup = group.key === activeGroup.key;
          return (
            <Link
              key={group.key}
              href={group.features[0].href}
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                whiteSpace: "nowrap",
                color: isActiveGroup ? "var(--teal)" : "var(--text-muted)",
              }}
            >
              {t(`group_${group.key}`)}
            </Link>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
        {activeGroup.features.map((f) => (
          <Link
            key={f.key}
            href={f.href}
            style={{
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
              color: active === f.key ? "var(--teal)" : "var(--text)",
            }}
          >
            {t(f.key)}
          </Link>
        ))}
      </div>
    </div>
  );
}
