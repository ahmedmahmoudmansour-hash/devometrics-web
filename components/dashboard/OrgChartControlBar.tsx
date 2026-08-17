"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  ORG_CHART_PRESETS,
  EXECUTIVE_MIN_DEPTH,
  EXECUTIVE_MAX_DEPTH,
  type OrgChartViewConfig,
  type OrgChartPresetKey,
  type OrgChartCardToggles,
} from "@/lib/orgChart/cardConfig";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

const PRESET_KEYS: OrgChartPresetKey[] = ["photo", "nameOnly", "positionOnly", "compact", "executive"];
const TOGGLE_KEYS: (keyof OrgChartCardToggles)[] = [
  "showPhoto",
  "showName",
  "showTitle",
  "showDepartment",
  "showLocation",
  "showTenure",
  "showPerformanceBadge",
  "showSuccessionStatus",
  "showPositionLinks",
];

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 11px",
    fontSize: 11.5,
    fontWeight: 600,
    borderRadius: 999,
    border: active ? "1px solid var(--teal)" : "1px solid var(--border)",
    background: active ? "rgba(var(--teal-rgb),0.1)" : "transparent",
    color: active ? "var(--teal)" : "var(--text-muted)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function labelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 };
}

export default function OrgChartControlBar({
  rows,
  config,
  activePresetKey,
  onChange,
}: {
  rows: WorkforceRow[];
  config: OrgChartViewConfig;
  activePresetKey: OrgChartPresetKey | null;
  onChange: (config: OrgChartViewConfig, presetKey: OrgChartPresetKey | null) => void;
}) {
  const t = useTranslations("orgChartControlBar");

  const options = useMemo(() => {
    const uniq = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))].sort();
    return {
      countries: uniq(rows.map((r) => r.country)),
      businessUnits: uniq(rows.map((r) => r.businessUnit)),
      departments: uniq(rows.map((r) => r.department)),
    };
  }, [rows]);

  function applyPreset(key: OrgChartPresetKey) {
    onChange({ ...ORG_CHART_PRESETS[key], filters: config.filters }, key);
  }

  function toggleField(key: keyof OrgChartCardToggles) {
    onChange({ ...config, toggles: { ...config.toggles, [key]: !config.toggles[key] } }, null);
  }

  function setDensity(density: OrgChartViewConfig["density"]) {
    onChange({ ...config, density }, null);
  }

  function setDepthCapEnabled(enabled: boolean) {
    onChange({ ...config, maxDepth: enabled ? EXECUTIVE_MIN_DEPTH + 1 : null }, null);
  }

  function setDepth(depth: number) {
    onChange({ ...config, maxDepth: depth }, null);
  }

  // Narrowed to the multiselect string[] dimensions specifically — filters
  // also has manualMode (boolean) and includedIds (string[], but exclusive
  // with these three, driven by OrgChartPeoplePicker instead), neither of
  // which this generic add/remove toggle applies to.
  function toggleFilter(dimension: "countries" | "businessUnits" | "departments", value: string) {
    const current = config.filters[dimension];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...config, filters: { ...config.filters, [dimension]: next } }, activePresetKey);
  }

  return (
    <div className="no-print" style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={labelStyle()}>{t("presets")}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESET_KEYS.map((key) => (
            <button key={key} type="button" onClick={() => applyPreset(key)} style={chipStyle(activePresetKey === key)}>
              {t(`preset_${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p style={labelStyle()}>{t("cardFields")}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TOGGLE_KEYS.map((key) => (
            <button key={key} type="button" onClick={() => toggleField(key)} style={chipStyle(config.toggles[key])}>
              {t(`toggle_${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <p style={labelStyle()}>{t("density")}</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setDensity("comfortable")} style={chipStyle(config.density === "comfortable")}>
              {t("densityComfortable")}
            </button>
            <button type="button" onClick={() => setDensity("compact")} style={chipStyle(config.density === "compact")}>
              {t("densityCompact")}
            </button>
          </div>
        </div>

        <div>
          <p style={labelStyle()}>{t("depthCap")}</p>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" onClick={() => setDepthCapEnabled(config.maxDepth === null)} style={chipStyle(config.maxDepth !== null)}>
              {config.maxDepth === null ? t("depthCapOff") : t("depthCapOn")}
            </button>
            {config.maxDepth !== null && (
              <input
                type="number"
                min={EXECUTIVE_MIN_DEPTH}
                max={EXECUTIVE_MAX_DEPTH}
                value={config.maxDepth}
                onChange={(e) => setDepth(Math.min(EXECUTIVE_MAX_DEPTH, Math.max(EXECUTIVE_MIN_DEPTH, Number(e.target.value) || EXECUTIVE_MIN_DEPTH)))}
                style={{ width: 52, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "var(--text)" }}
              />
            )}
          </div>
        </div>
      </div>

      {(options.countries.length > 0 || options.businessUnits.length > 0 || options.departments.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          {options.countries.length > 0 && (
            <div>
              <p style={labelStyle()}>{t("filterCountry")}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {options.countries.map((c) => (
                  <button key={c} type="button" onClick={() => toggleFilter("countries", c)} style={chipStyle(config.filters.countries.includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {options.businessUnits.length > 0 && (
            <div>
              <p style={labelStyle()}>{t("filterBusinessUnit")}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {options.businessUnits.map((b) => (
                  <button key={b} type="button" onClick={() => toggleFilter("businessUnits", b)} style={chipStyle(config.filters.businessUnits.includes(b))}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}
          {options.departments.length > 0 && (
            <div>
              <p style={labelStyle()}>{t("filterDepartment")}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {options.departments.map((d) => (
                  <button key={d} type="button" onClick={() => toggleFilter("departments", d)} style={chipStyle(config.filters.departments.includes(d))}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
