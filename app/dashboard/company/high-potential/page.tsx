import Link from "next/link";
import { redirect } from "next/navigation";
import { buildCompanyData, type WorkforceRow } from "@/lib/organizations/aggregate";
import CompanyNavTabs from "@/components/dashboard/CompanyNavTabs";
import Avatar from "@/components/Avatar";
import { computeNineBoxPoint, zoneForPoint } from "@/lib/organizations/nineBox";
import { NineBoxLegend } from "@/components/dashboard/charts";

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
const ZONE_ORDER = ["Future Leader", "Future Star", "High Potential"] as const;

const ZONE_BLURB: Record<(typeof ZONE_ORDER)[number], string> = {
  "Future Leader": "High measured capability and strong leadership growth signal — your nearest-term succession bench. These are the people Succession Planning should already be scoring against your critical roles.",
  "Future Star": "Solid capability with strong growth signal — engaged and ready to be stretched further with visibility and bigger assignments.",
  "High Potential": "Capability is still developing, but the growth signal is strong — this is typically where early-career and junior employees who are quietly outperforming their tenure show up. The highest-leverage group for deliberate investment: sponsorship, stretch assignments, and structured development, before capability catches up on its own.",
};

type PoolEntry = {
  row: WorkforceRow;
  x: number;
  y: number;
  zoneLabel: (typeof ZONE_ORDER)[number];
};

export default async function HighPotentialPoolPage() {
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
            ← Back to progress
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            High Potential Pool
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
            A consolidated, cross-role roster of everyone in the top-growth-signal row of your talent
            grid — not tied to one specific role. Complements Succession Planning: that page answers
            &quot;who fits this critical role,&quot; this one answers &quot;who across the whole
            organization deserves deliberate investment right now,&quot; juniors included.
          </p>
        </div>

        <CompanyNavTabs active="highPotential" />

        {data.rows.length === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              No team members yet — this pool populates as your people join and complete a Gap
              Analysis.
            </p>
          </div>
        ) : measuredCount === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              No one on your team has run a Gap Analysis yet, so there&apos;s no measured data to
              place anyone on the grid. This isn&apos;t a reflection of your team — the tools just
              haven&apos;t been used yet.
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div style={card}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              No one currently lands in the top growth-signal row of the grid.{" "}
              {measuredCount} of {data.rows.length} employees have measured data — as more people run
              a Gap Analysis (and complete assessments in the Leadership-adjacent dimensions), this
              pool will start to populate honestly rather than by inference.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{entries.length}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>In the pool</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
                  {byZone.get("High Potential")?.length ?? 0}
                </p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>High Potential zone (developing capability)</p>
              </div>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
                  {byZone.get("Future Leader")?.length ?? 0}
                </p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Future Leader zone (succession-ready)</p>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, flexBasis: "100%", marginTop: 4 }}>
                Based only on measured Gap Analysis competency levels — no demographic attributes,
                tenure, or manager opinion factor into this. Someone missing from this list may simply
                be undermeasured, not lower-potential; {measuredCount} of {data.rows.length} employees
                have run a Gap Analysis so far.
              </p>
            </div>

            {ZONE_ORDER.map((zoneLabel) => {
              const list = byZone.get(zoneLabel);
              if (!list || list.length === 0) return null;
              return (
                <div key={zoneLabel} style={card}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                    {zoneLabel} <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>({list.length})</span>
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6, maxWidth: 640 }}>
                    {ZONE_BLURB[zoneLabel]}
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
                            {[e.row.title, e.row.department].filter(Boolean).join(" · ") || "No title on file"}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--teal)" }}>
                            {Math.round(e.y)}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>growth signal</p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, width: 70 }}>
                          <p className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                            {Math.round(e.x)}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>capability</p>
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
