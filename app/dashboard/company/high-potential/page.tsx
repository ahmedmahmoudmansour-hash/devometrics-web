import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buildCompanyData, type WorkforceRow } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import Avatar from "@/components/Avatar";
import { computeNineBoxPoint, zoneForPoint } from "@/lib/organizations/nineBox";
import { zoneLabel as translatedZoneLabel } from "@/lib/organizations/nineBoxZones";
import { NineBoxLegend } from "@/components/dashboard/charts";
import FeatureEmailComposer from "@/components/dashboard/FeatureEmailComposer";
import { listFeatureEmailHistory } from "@/lib/organizations/featureEmails";

export const metadata = { title: "High Potential Pool — Devometrics" };

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
};

// The three top-row 9-box zones (see NINE_BOX_ZONES in
// components/dashboard/charts.tsx), ordered by how close each is to
// senior succession-readiness rather than by raw growth score. This
// ordering is the whole point of the page: "Future Leader" is the same
// bench Succession draws from (high capability, high growth); "High
// Potential" is deliberately the opposite corner — capability still
// developing, but growth signal strong — which in practice is where
// early-career and junior employees who are quietly outperforming their
// tenure tend to land. One roster, two very different action items.
// Zone names and the blurb prose below are both translated via
// ZONE_TRANSLATION_KEY (lib/organizations/nineBoxZones.ts), keyed by the
// same stable English zone name used for lookup/grouping throughout.
const ZONE_ORDER = ["Future Leader", "Future Star", "High Potential"] as const;

const ZONE_BLURB_KEY: Record<(typeof ZONE_ORDER)[number], string> = {
  "Future Leader": "futureLeaderBlurb",
  "Future Star": "futureStarBlurb",
  "High Potential": "highPotentialBlurb",
};

type PoolEntry = {
  row: WorkforceRow;
  x: number;
  y: number;
  zoneLabel: (typeof ZONE_ORDER)[number];
};

export default async function HighPotentialPoolPage() {
  const t = await getTranslations("highPotentialPage");
  const tZones = await getTranslations("nineBoxZones");
  const data = await buildCompanyData();
  if (!data.isOrgAdmin) redirect("/dashboard");

  const entries: PoolEntry[] = data.rows
    .map((row) => {
      const point = computeNineBoxPoint(row.dimensionLevels);
      if (!point) return null;
      const zone = zoneForPoint(point.x, point.y);
      if (zone.row !== 2) return null; // only the top growth-signal row qualifies for this pool
      return { row, x: point.x, y: point.y, zoneLabel: zone.label as PoolEntry["zoneLabel"] };
    })
    .filter((e): e is PoolEntry => e !== null);

  const byZone = new Map<string, PoolEntry[]>();
  for (const e of entries) {
    const list = byZone.get(e.zoneLabel) ?? [];
    list.push(e);
    byZone.set(e.zoneLabel, list);
  }
  for (const list of byZone.values()) list.sort((a, b) => b.y - a.y || b.x - a.x);

  const measuredCount = data.rows.filter((r) => Object.keys(r.dimensionLevels).length > 0).length;

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            {t("backToProgress")}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            {t("description")}
          </p>
        </div>

        <CompanyNavTabs active="highPotential" />

        {data.organizationId && (
          <FeatureEmailComposer
            organizationId={data.organizationId}
            featureKey="high_potential"
            employees={data.rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email, department: r.department }))}
            initialHistory={await listFeatureEmailHistory(data.organizationId, "high_potential")}
          />
        )}

        {data.rows.length === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("noTeamMembersYet")}
            </p>
          </div>
        ) : measuredCount === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("noMeasuredData")}
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("noOneInTopRow", { measured: measuredCount, total: data.rows.length })}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{entries.length}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("inThePool")}</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
                  {byZone.get("High Potential")?.length ?? 0}
                </p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>High Potential {t("zoneSuffixDevelopingCapability")}</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
                  {byZone.get("Future Leader")?.length ?? 0}
                </p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Future Leader {t("zoneSuffixSuccessionReady")}</p>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, flexBasis: "100%", marginTop: 4 }}>
                {t("measuredNote", { measured: measuredCount, total: data.rows.length })}
              </p>
            </div>

            {ZONE_ORDER.map((zoneLabel) => {
              const list = byZone.get(zoneLabel);
              if (!list || list.length === 0) return null;
              return (
                <div key={zoneLabel} style={card}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                    {translatedZoneLabel(tZones, zoneLabel)} <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>({list.length})</span>
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 640 }}>
                    {t(ZONE_BLURB_KEY[zoneLabel])}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {list.map((e) => (
                      <Link
                        key={e.row.userId}
                        href={`/dashboard/company/${e.row.userId}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 8px",
                          borderRadius: 10,
                          textDecoration: "none",
                        }}
                      >
                        <Avatar name={e.row.name} avatarUrl={e.row.avatarUrl} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{e.row.name}</p>
                          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                            {[e.row.title, e.row.department].filter(Boolean).join(" · ") || t("noTitleOnFile")}
                          </p>
                        </div>
                        <div style={{ textAlign: "end", flexShrink: 0 }}>
                          <p className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal)" }}>
                            {Math.round(e.y)}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{t("growthSignal")}</p>
                        </div>
                        <div style={{ textAlign: "end", flexShrink: 0, width: 70 }}>
                          <p className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                            {Math.round(e.x)}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{t("capability")}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}

            <div style={card}>
              <NineBoxLegend forceOpen />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
