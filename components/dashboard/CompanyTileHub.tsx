import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Users, Wallet, TrendingUp, Briefcase, ClipboardCheck, Settings, ChevronRight } from "lucide-react";
import { COMPANY_TILES, type CompanyFeatureKey, type CompanyTileKey } from "@/lib/organizations/companyTiles";

const TILE_ICONS: Record<CompanyTileKey, React.ComponentType<{ size?: number }>> = {
  people: Users,
  timePay: Wallet,
  talent: TrendingUp,
  hiringGrowth: Briefcase,
  performance: ClipboardCheck,
  settings: Settings,
};

// Six large tiles instead of an 18-link wall: each is an area of the
// company, showing its own features underneath as one-click rows with a
// live stat where there's one worth showing. The company profile row is
// left out (this page IS it), and anything the admin switched off in
// "Tiles & features" is hidden — a tile with nothing left disappears.
export default async function CompanyTileHub({
  stats,
  disabled,
}: {
  stats: Partial<Record<CompanyFeatureKey, string>>;
  disabled: string[];
}) {
  const t = await getTranslations("companyHub");
  const tNav = await getTranslations("companyNavTabs");
  const off = new Set(disabled);

  const tiles = COMPANY_TILES.map((tile) => ({
    ...tile,
    features: tile.features.filter((f) => !f.hubHidden && !off.has(f.key)),
  })).filter((tile) => tile.features.length > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 28 }}>
      {tiles.map((tile) => {
        const Icon = TILE_ICONS[tile.key];
        return (
          <section
            key={tile.key}
            style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  color: "var(--teal)",
                  background: "rgba(var(--teal-rgb),0.1)",
                  border: "1px solid rgba(var(--teal-rgb),0.2)",
                  flexShrink: 0,
                }}
              >
                <Icon size={19} />
              </span>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{tNav(`group_${tile.key}`)}</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{t(`tile_${tile.key}`)}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {tile.features.map((f) => (
                <Link
                  key={f.key}
                  href={f.href}
                  className="card-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 4px",
                    borderTop: "1px solid var(--border)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{tNav(f.key)}</span>
                    {stats[f.key] && (
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {stats[f.key]}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
