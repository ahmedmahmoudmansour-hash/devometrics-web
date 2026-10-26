"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createOrganizationCompetency,
  updateOrganizationCompetency,
  deleteOrganizationCompetency,
  setOrganizationCompetencyActive,
  suggestDimensionForCompetency,
} from "@/lib/organizations/competencies";
import { COMPETENCY_CATEGORIES, MAX_LEVEL_INDICATOR_LENGTH, type CompetencyCategory } from "@/lib/proficiency/library";
import { PROFICIENCY_LEVELS } from "@/lib/proficiency/levels";
import { COMPETENCY_DIMENSIONS, dimensionLabel, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
import { levelText } from "@/lib/ui/levelColor";
import type { OrganizationCompetency } from "@/lib/supabase/types";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 };

// Type of competency, and what each of the five levels looks like. Used by the add
// form and the edit form so both behave the same.
function CategorySelect({ value, onChange }: { value: CompetencyCategory; onChange: (v: CompetencyCategory) => void }) {
  const tLib = useTranslations("competencyLibrary");
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CompetencyCategory)}
      style={{ ...inputStyle, cursor: "pointer" }}
      aria-label={tLib("categoryLabel")}
    >
      {COMPETENCY_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {tLib(`category_${c}`)}
        </option>
      ))}
    </select>
  );
}

function LevelIndicatorsEditor({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const tLib = useTranslations("competencyLibrary");
  const tProf = useTranslations("proficiency");
  return (
    <details>
      <summary style={{ fontSize: 12, color: "var(--teal)", cursor: "pointer" }}>{tLib("indicatorsLabel")}</summary>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "8px 0", lineHeight: 1.5 }}>{tLib("indicatorsHint")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PROFICIENCY_LEVELS.map((level) => (
          <div key={level}>
            <label style={{ ...labelStyle, marginBottom: 4 }}>
              {tProf("levelShort", { level })} · {tProf(`level${level}`)}
            </label>
            <textarea
              value={value[String(level)] ?? ""}
              onChange={(e) => onChange({ ...value, [String(level)]: e.target.value })}
              rows={2}
              maxLength={MAX_LEVEL_INDICATOR_LENGTH}
              placeholder={tLib("indicatorPlaceholder")}
              style={{ ...inputStyle, resize: "vertical", fontSize: 13 }}
            />
          </div>
        ))}
      </div>
    </details>
  );
}

function CompetencyBar({
  competency,
  score,
}: {
  competency: OrganizationCompetency;
  score: number | null;
}) {
  const t = useTranslations("organizationCompetencyBuilder");
  const tDim = useTranslations("competencyDimensions");
  if (!competency.mapped_dimension) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{competency.name}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("notMappedToScoredDimension")}</span>
        </div>
        {competency.description && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{competency.description}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{competency.name}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: 8 }}>
            {t("mapsTo", { dimension: dimensionLabel(tDim, competency.mapped_dimension) })}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: levelText(score) }}>{score ?? "—"}/100</span>
      </div>
      {competency.description && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.5 }}>{competency.description}</p>
      )}
      <div style={{ height: 8, borderRadius: 100, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div
          style={{
            width: `${score ?? 0}%`,
            height: "100%",
            background: levelText(score),
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

const UNMAPPED = "" as const;

function CompetencyRow({ competency }: { competency: OrganizationCompetency }) {
  const t = useTranslations("organizationCompetencyBuilder");
  const tDim = useTranslations("competencyDimensions");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(competency.name);
  const [description, setDescription] = useState(competency.description ?? "");
  const [dimension, setDimension] = useState<CompetencyDimension | typeof UNMAPPED>(competency.mapped_dimension ?? UNMAPPED);
  const [category, setCategory] = useState<CompetencyCategory>(competency.category ?? "behavioural");
  const [indicators, setIndicators] = useState<Record<string, string>>(competency.level_indicators ?? {});
  const tLib = useTranslations("competencyLibrary");
  const retired = competency.is_active === false;
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, startSuggest] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSuggest() {
    setError(null);
    startSuggest(async () => {
      const result = await suggestDimensionForCompetency(name, description);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDimension(result.dimension ?? UNMAPPED);
    });
  }

  if (!editing) {
    return (
      <div style={{ padding: "8px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ opacity: retired ? 0.65 : 1 }}>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{competency.name}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginInlineStart: 8 }}>
              ({competency.mapped_dimension ?? t("notMapped")})
            </span>
            {competency.category && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: 8 }}>· {tLib(`category_${competency.category}`)}</span>
            )}
            {retired && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 999, padding: "1px 8px", marginInlineStart: 8 }}>
                {tLib("retiredBadge")}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              {t("edit")}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setOrganizationCompetencyActive(competency.id, retired);
                  setError(result?.error ?? null);
                })
              }
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              {retired ? tLib("reactivate") : tLib("retire")}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteOrganizationCompetency(competency.id);
                  setError(result?.error ?? null);
                })
              }
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              {t("delete")}
            </button>
          </div>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} aria-label={t("competencyNameAriaLabel")} />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        style={{ ...inputStyle, resize: "vertical" }}
        aria-label={t("competencyDescriptionAriaLabel")}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value as CompetencyDimension | typeof UNMAPPED)}
          style={{ ...inputStyle, cursor: "pointer", flex: 1 }}
          aria-label={t("mappedDimensionAriaLabel")}
        >
          <option value={UNMAPPED}>{t("notMappedOptional")}</option>
          {COMPETENCY_DIMENSIONS.map((d) => (
            <option key={d} value={d}>
              {dimensionLabel(tDim, d)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isSuggesting || !name.trim()}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {isSuggesting ? t("thinking") : t("suggestWithAi")}
        </button>
      </div>
      <CategorySelect value={category} onChange={setCategory} />
      <LevelIndicatorsEditor value={indicators} onChange={setIndicators} />
      {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateOrganizationCompetency(competency.id, {
                name,
                description,
                mappedDimension: dimension === UNMAPPED ? null : dimension,
                category,
                levelIndicators: indicators,
              });
              if (result?.error) setError(result.error);
              else {
                setError(null);
                setEditing(false);
              }
            })
          }
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          {t("save")}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

export default function OrganizationCompetencyBuilder({
  organizationId,
  competencies,
  dimensionAverages,
}: {
  organizationId: string;
  competencies: OrganizationCompetency[];
  dimensionAverages: Partial<Record<CompetencyDimension, number>>;
}) {
  const t = useTranslations("organizationCompetencyBuilder");
  const tDim = useTranslations("competencyDimensions");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dimension, setDimension] = useState<CompetencyDimension | typeof UNMAPPED>(UNMAPPED);
  const [category, setCategory] = useState<CompetencyCategory>("behavioural");
  const [indicators, setIndicators] = useState<Record<string, string>>({});
  const tLib = useTranslations("competencyLibrary");
  const [isPending, startTransition] = useTransition();
  const [isSuggesting, startSuggest] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSuggest() {
    setError(null);
    startSuggest(async () => {
      const result = await suggestDimensionForCompetency(name, description);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDimension(result.dimension ?? UNMAPPED);
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createOrganizationCompetency(organizationId, {
        name,
        description,
        mappedDimension: dimension === UNMAPPED ? null : dimension,
        category,
        levelIndicators: indicators,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setName("");
      setDescription("");
      setDimension(UNMAPPED);
      setCategory("behavioural");
      setIndicators({});
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {t("yourCompetencyFramework")}
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        {t("frameworkDesc")}
      </p>

      {competencies.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {competencies.map((c) => (
            <CompetencyBar
              key={c.id}
              competency={c}
              score={c.mapped_dimension ? dimensionAverages[c.mapped_dimension] ?? null : null}
            />
          ))}
        </div>
      )}

      {competencies.length > 0 && (
        <div style={{ marginBottom: 20, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            {t("manageLabel")}
          </p>
          {competencies.some((c) => c.is_active === false) && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.5 }}>{tLib("retiredHint")}</p>
          )}
          {competencies.map((c) => (
            <CompetencyRow key={c.id} competency={c} />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>{t("competencyNameLabel")}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("competencyNamePlaceholder")}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t("descriptionLabel")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div>
          <label style={labelStyle}>{t("mapsToLabel")}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as CompetencyDimension | typeof UNMAPPED)}
              style={{ ...inputStyle, cursor: "pointer", flex: 1 }}
            >
              <option value={UNMAPPED}>{t("notMappedOptional")}</option>
              {COMPETENCY_DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {dimensionLabel(tDim, d)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={isSuggesting || !name.trim()}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {isSuggesting ? t("thinking") : t("suggestWithAi")}
            </button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>{tLib("categoryLabel")}</label>
          <CategorySelect value={category} onChange={setCategory} />
        </div>
        <LevelIndicatorsEditor value={indicators} onChange={setIndicators} />
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          style={{
            alignSelf: "flex-start",
            background: "var(--teal)",
            color: "#0A0F1E",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? t("adding") : t("addCompetency")}
        </button>
      </form>
    </div>
  );
}
