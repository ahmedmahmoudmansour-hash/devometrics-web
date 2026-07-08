"use client";

import { useState, useTransition } from "react";
import {
  createOrganizationCompetency,
  updateOrganizationCompetency,
  deleteOrganizationCompetency,
  suggestDimensionForCompetency,
} from "@/lib/organizations/competencies";
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from "@/lib/gap-analysis/dimensions";
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

function CompetencyBar({
  competency,
  score,
}: {
  competency: OrganizationCompetency;
  score: number | null;
}) {
  if (!competency.mapped_dimension) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{competency.name}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Not mapped to a scored dimension</span>
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
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
            → maps to {competency.mapped_dimension}
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(competency.name);
  const [description, setDescription] = useState(competency.description ?? "");
  const [dimension, setDimension] = useState<CompetencyDimension | typeof UNMAPPED>(competency.mapped_dimension ?? UNMAPPED);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
        <div>
          <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{competency.name}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
            ({competency.mapped_dimension ?? "not mapped"})
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
          >
            Edit
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => { deleteOrganizationCompetency(competency.id); })}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} aria-label="Competency name" />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        style={{ ...inputStyle, resize: "vertical" }}
        aria-label="Competency description"
      />
      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value as CompetencyDimension | typeof UNMAPPED)}
          style={{ ...inputStyle, cursor: "pointer", flex: 1 }}
          aria-label="Mapped dimension"
        >
          <option value={UNMAPPED}>Not mapped (optional)</option>
          {COMPETENCY_DIMENSIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isSuggesting || !name.trim()}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {isSuggesting ? "Thinking…" : "Suggest with AI"}
        </button>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12 }}>{error}</p>}
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
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
        >
          Cancel
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dimension, setDimension] = useState<CompetencyDimension | typeof UNMAPPED>(UNMAPPED);
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
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setName("");
      setDescription("");
      setDimension(UNMAPPED);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Your competency framework
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        Name your own competencies (in your company&apos;s own language) and map each one onto the
        dimension that actually drives scoring — the chart below translates your framework into real
        team-average scores from the underlying assessment engine.
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
            Manage
          </p>
          {competencies.map((c) => (
            <CompetencyRow key={c.id} competency={c} />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>Competency name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer Obsession"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this means at your company"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Maps to (optional)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as CompetencyDimension | typeof UNMAPPED)}
              style={{ ...inputStyle, cursor: "pointer", flex: 1 }}
            >
              <option value={UNMAPPED}>Not mapped (optional)</option>
              {COMPETENCY_DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={isSuggesting || !name.trim()}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {isSuggesting ? "Thinking…" : "Suggest with AI"}
            </button>
          </div>
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
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
          {isPending ? "Adding…" : "Add competency"}
        </button>
      </form>
    </div>
  );
}
