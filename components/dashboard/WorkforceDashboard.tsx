"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { COMPETENCY_DIMENSIONS, dimensionLabel, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { computeNineBoxPoint } from "@/lib/organizations/nineBox";
import { DonutChart, HBarChart, NineBoxGrid, NineBoxLegend, TrendLineChart } from "@/components/dashboard/charts";
import type { MonthlyPoint } from "@/lib/organizations/trends";

type Row = {
  userId: string;
  name: string;
  department: string | null;
  country: string | null;
  careerHealthScore: number | null;
  dimensionLevels: Partial<Record<CompetencyDimension, number>>;
};

type AttentionItem = { text: string; href: string; severity: "info" | "warning" };

type Props = {
  rows: Row[];
  hiring: { openPostings: number; totalCandidates: number; totalHired: number };
  surveys: { id: string; title: string; responseCount: number | null; assignedCount: number }[];
  attentionItems: AttentionItem[];
  careerHealthTrendData: MonthlyPoint[];
  headcountTrendData: MonthlyPoint[];
  flightRiskTrendData: MonthlyPoint[] | null;
};

const VIEW_STORAGE_KEY = "devometrics-dashboard-view";
type ViewMode = "strategic" | "operational";

const card: React.CSSProperties = {
  background: "var(--navy-mid)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
};
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 };
const cardHint: React.CSSProperties = { fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 14 };

// The persisted view choice is external state (localStorage), so it's
// read via useSyncExternalStore rather than useState+useEffect — the
// latter would need a setState call inside the effect body just to sync
// from an external source, which is exactly the anti-pattern
// useSyncExternalStore exists to replace. getServerSnapshot returns the
// default so SSR and first client render agree, with zero flash.
function subscribeToViewStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function getViewSnapshot(): ViewMode {
  const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return saved === "operational" ? "operational" : "strategic";
}
function getViewServerSnapshot(): ViewMode {
  return "strategic";
}

function groupCount<T>(rows: T[], key: (r: T) => string | null, unspecifiedLabel: string): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? unspecifiedLabel;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export default function WorkforceDashboard({
  rows,
  hiring,
  surveys,
  attentionItems,
  careerHealthTrendData,
  headcountTrendData,
  flightRiskTrendData,
}: Props) {
  const t = useTranslations("workforceDashboard");
  const tAnalytics = useTranslations("companyAnalyticsPage");
  const tDim = useTranslations("competencyDimensions");

  const view = useSyncExternalStore(subscribeToViewStorage, getViewSnapshot, getViewServerSnapshot);
  const [department, setDepartment] = useState<string>("all");

  function chooseView(next: ViewMode) {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    // "storage" only fires in OTHER tabs by spec — dispatch it manually so
    // this tab's own useSyncExternalStore snapshot updates too.
    window.dispatchEvent(new Event("storage"));
  }

  const unspecifiedLabel = tAnalytics("unspecified");
  const byDepartment = useMemo(() => groupCount(rows, (r) => r.department, unspecifiedLabel), [rows, unspecifiedLabel]);
  const byCountry = useMemo(() => groupCount(rows, (r) => r.country, unspecifiedLabel), [rows, unspecifiedLabel]);

  const departmentOptions = useMemo(() => byDepartment.map((d) => d.label).filter((d) => d !== unspecifiedLabel), [byDepartment, unspecifiedLabel]);

  const filteredRows = useMemo(
    () => (department === "all" ? rows : rows.filter((r) => (r.department ?? unspecifiedLabel) === department)),
    [rows, department, unspecifiedLabel]
  );

  const withAnalysis = useMemo(() => filteredRows.filter((r) => Object.keys(r.dimensionLevels).length > 0), [filteredRows]);

  const avgCareerHealth = useMemo(() => {
    const scores = filteredRows.map((r) => r.careerHealthScore).filter((v): v is number => v !== null);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  }, [filteredRows]);

  const healthByDept = useMemo(
    () =>
      byDepartment
        .map((d) => {
          const members = rows.filter((r) => (r.department ?? unspecifiedLabel) === d.label && r.careerHealthScore !== null);
          if (members.length === 0) return null;
          return { label: d.label, value: Math.round(members.reduce((a, r) => a + (r.careerHealthScore ?? 0), 0) / members.length) };
        })
        .filter((d): d is { label: string; value: number } => d !== null),
    [byDepartment, rows, unspecifiedLabel]
  );

  const dimensionBars = useMemo(() => {
    const bars = COMPETENCY_DIMENSIONS.map((dim) => {
      const values = withAnalysis.map((r) => r.dimensionLevels[dim]).filter((v): v is number => v !== undefined);
      return {
        dim,
        label: dimensionLabel(tDim, dim),
        value: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      };
    }).filter((d): d is { dim: CompetencyDimension; label: string; value: number } => d.value !== null);
    return bars.sort((a, b) => b.value - a.value);
  }, [withAnalysis, tDim]);

  const strengths = dimensionBars.slice(0, 3);
  const gaps = [...dimensionBars].reverse().slice(0, 3);

  const nineBoxPoints = useMemo(
    () =>
      withAnalysis
        .map((r) => {
          const point = computeNineBoxPoint(r.dimensionLevels);
          return point ? { name: r.name, ...point } : null;
        })
        .filter((p): p is { name: string; x: number; y: number } => p !== null),
    [withAnalysis]
  );

  const coveragePct = filteredRows.length ? Math.round((withAnalysis.length / filteredRows.length) * 100) : 0;

  const topAttention = attentionItems.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "inline-flex", background: "var(--navy-light)", border: "1px solid var(--border)", borderRadius: 999, padding: 3, gap: 2 }}>
          {(["strategic", "operational"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => chooseView(mode)}
              style={{
                padding: "7px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: view === mode ? "var(--teal)" : "transparent",
                color: view === mode ? "var(--navy)" : "var(--text-muted)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {mode === "strategic" ? t("strategicView") : t("operationalView")}
            </button>
          ))}
        </div>

        {departmentOptions.length > 1 && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{
              background: "var(--navy-light)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text)",
              fontSize: 12.5,
              fontWeight: 600,
              padding: "8px 12px",
            }}
          >
            <option value="all">{t("allDepartments")}</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
        {view === "strategic" ? t("strategicViewHint") : t("operationalViewHint")}
      </p>

      {/* KPI row — responds to the department filter */}
      <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{filteredRows.length}</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{department === "all" ? tAnalytics("activeEmployees") : t("employeesInDepartment")}</p>
        </div>
        <div>
          <p style={{ fontSize: 26, fontWeight: 800, color: coveragePct >= 70 ? "var(--teal)" : "var(--amber)" }}>{coveragePct}%</p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{tAnalytics("gapAnalysisCoverage")}</p>
        </div>
        {avgCareerHealth !== null && (
          <div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "var(--teal)" }}>{avgCareerHealth}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{tAnalytics("companyCareerHealth")}</p>
          </div>
        )}
        {department === "all" && (
          <>
            <div>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{hiring.openPostings}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("openPostings")}</p>
            </div>
            <div>
              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{hiring.totalCandidates}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("candidatesInPipeline")}</p>
            </div>
          </>
        )}
      </div>

      {view === "strategic" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            <div style={card}>
              <h2 style={cardTitle}>{t("careerHealthTrend")}</h2>
              <p style={cardHint}>{t("careerHealthTrendHint")}</p>
              <TrendLineChart data={careerHealthTrendData} />
            </div>
            <div style={card}>
              <h2 style={cardTitle}>{t("headcountTrend")}</h2>
              <p style={cardHint}>{t("headcountTrendHint")}</p>
              <TrendLineChart data={headcountTrendData} color="var(--phase2)" />
            </div>
          </div>

          {flightRiskTrendData && (
            <div style={card}>
              <h2 style={cardTitle}>{t("flightRiskTrend")}</h2>
              <p style={cardHint}>{t("flightRiskTrendHint")}</p>
              <TrendLineChart data={flightRiskTrendData} color="var(--amber)" />
            </div>
          )}

          {(strengths.length > 0 || gaps.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
              {strengths.length > 0 && (
                <div style={card}>
                  <h2 style={cardTitle}>{t("topStrengths")}</h2>
                  <p style={cardHint}>{t("topStrengthsHint")}</p>
                  <HBarChart data={strengths.map((s) => ({ label: s.label, value: s.value, color: "var(--teal)" }))} maxValue={100} />
                </div>
              )}
              {gaps.length > 0 && (
                <div style={card}>
                  <h2 style={cardTitle}>{t("topGaps")}</h2>
                  <p style={cardHint}>{t("topGapsHint")}</p>
                  <HBarChart data={gaps.map((g) => ({ label: g.label, value: g.value, color: "var(--amber)" }))} maxValue={100} />
                </div>
              )}
            </div>
          )}

          {nineBoxPoints.length > 0 && (
            <div style={card}>
              <h2 style={cardTitle}>{tAnalytics("talentGrid")}</h2>
              <p style={cardHint}>{tAnalytics("talentGridHint")}</p>
              <NineBoxGrid points={nineBoxPoints} xLabel={tAnalytics("measuredCapability")} yLabel={tAnalytics("leadershipGrowthSignal")} />
              <NineBoxLegend />
            </div>
          )}

          {topAttention.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("topAttentionTitle")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topAttention.map((item, i) => (
                  <Link key={i} href={item.href} style={{ display: "flex", alignItems: "flex-start", gap: 10, textDecoration: "none" }}>
                    <span style={{ flexShrink: 0, marginTop: 5, width: 6, height: 6, borderRadius: "50%", background: item.severity === "warning" ? "var(--amber)" : "var(--teal)" }} />
                    <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{item.text}</span>
                  </Link>
                ))}
              </div>
              {attentionItems.length > topAttention.length && (
                <button
                  type="button"
                  onClick={() => chooseView("operational")}
                  style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--teal)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {t("seeAllAttention", { count: attentionItems.length })}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            <div style={card}>
              <h2 style={cardTitle}>{tAnalytics("headcountByDepartment")}</h2>
              <p style={cardHint}>{tAnalytics("headcountByDepartmentHint")}</p>
              <DonutChart data={byDepartment} />
            </div>
            <div style={card}>
              <h2 style={cardTitle}>{tAnalytics("headcountByCountry")}</h2>
              <p style={cardHint}>{tAnalytics("headcountByCountryHint")}</p>
              <DonutChart data={byCountry} />
            </div>
          </div>

          {healthByDept.length > 0 && (
            <div style={card}>
              <h2 style={cardTitle}>{tAnalytics("careerHealthByDepartment")}</h2>
              <p style={cardHint}>{tAnalytics("careerHealthByDepartmentHint")}</p>
              <HBarChart data={healthByDept} maxValue={100} />
            </div>
          )}

          {dimensionBars.length > 0 && (
            <div style={card}>
              <h2 style={cardTitle}>{tAnalytics("orgCompetencyProfile")}</h2>
              <p style={cardHint}>{tAnalytics("orgCompetencyProfileHint")}</p>
              <HBarChart
                data={dimensionBars.map((d) => ({
                  label: d.label,
                  value: d.value,
                  color: strengths.some((s) => s.label === d.label) ? "var(--teal)" : gaps.some((g) => g.label === d.label) ? "var(--amber)" : "var(--phase2)",
                }))}
                maxValue={100}
              />
            </div>
          )}

          {nineBoxPoints.length > 0 && (
            <div style={card}>
              <h2 style={cardTitle}>{tAnalytics("talentGrid")}</h2>
              <p style={cardHint}>{tAnalytics("talentGridHint")}</p>
              <NineBoxGrid points={nineBoxPoints} xLabel={tAnalytics("measuredCapability")} yLabel={tAnalytics("leadershipGrowthSignal")} />
              <NineBoxLegend />
            </div>
          )}

          {surveys.length > 0 && (
            <div style={card}>
              <h2 style={cardTitle}>{t("surveyParticipationDetail")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {surveys.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--text)" }}>{s.title}</span>
                    <span className="mono" style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                      {s.responseCount ?? 0}/{s.assignedCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {attentionItems.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{t("allAttentionTitle")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {attentionItems.map((item, i) => (
                  <Link key={i} href={item.href} style={{ display: "flex", alignItems: "flex-start", gap: 10, textDecoration: "none" }}>
                    <span style={{ flexShrink: 0, marginTop: 5, width: 6, height: 6, borderRadius: "50%", background: item.severity === "warning" ? "var(--amber)" : "var(--teal)" }} />
                    <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{item.text}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <details style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
            <summary style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}>{tAnalytics("methodologyDisclosure")}</summary>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              <p>{tAnalytics("methodologyP1")}</p>
              <p>{tAnalytics("methodologyP2")}</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
