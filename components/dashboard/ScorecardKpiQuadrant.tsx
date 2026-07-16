"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createScorecardKpi, updateScorecardKpi, deleteScorecardKpi } from "@/lib/companyScorecard/actions";
import type { ScorecardKpi, ScorecardKpiStatus, ScorecardPerspective } from "@/lib/supabase/types";

const STATUS_LABEL: Record<ScorecardKpiStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

const STATUS_COLOR: Record<ScorecardKpiStatus, string> = {
  on_track: "var(--teal)",
  at_risk: "var(--amber)",
  off_track: "#f87171",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 11px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
};

type KpiFields = { name: string; target: string; actual: string; status: ScorecardKpiStatus; note: string };
const EMPTY_FIELDS: KpiFields = { name: "", target: "", actual: "", status: "on_track", note: "" };

function KpiForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: KpiFields;
  onSave: (fields: KpiFields) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [fields, setFields] = useState<KpiFields>(initial);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.02)" }}>
      <input style={inputStyle} placeholder="KPI name — e.g. Customer Satisfaction (CSAT)" value={fields.name} onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inputStyle} placeholder="Target — e.g. 90%" value={fields.target} onChange={(e) => setFields((f) => ({ ...f, target: e.target.value }))} />
        <input style={inputStyle} placeholder="Actual — e.g. 84%" value={fields.actual} onChange={(e) => setFields((f) => ({ ...f, actual: e.target.value }))} />
      </div>
      <select style={{ ...inputStyle, cursor: "pointer" }} value={fields.status} onChange={(e) => setFields((f) => ({ ...f, status: e.target.value as ScorecardKpiStatus }))}>
        {(Object.keys(STATUS_LABEL) as ScorecardKpiStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} placeholder="Note (optional)" value={fields.note} onChange={(e) => setFields((f) => ({ ...f, note: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={isPending || !fields.name.trim()}
          onClick={() => onSave(fields)}
          style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: isPending || !fields.name.trim() ? 0.5 : 1 }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function KpiCard({ kpi, onChanged }: { kpi: ScorecardKpi; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <KpiForm
        initial={{ name: kpi.name, target: kpi.target, actual: kpi.actual, status: kpi.status, note: kpi.note }}
        isPending={isPending}
        onCancel={() => setEditing(false)}
        onSave={(fields) =>
          startTransition(async () => {
            setError(null);
            const result = await updateScorecardKpi(kpi.id, fields);
            if (result?.error) setError(result.error);
            else {
              setEditing(false);
              onChanged();
            }
          })
        }
      />
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{kpi.name}</span>
        <span
          className="mono"
          style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLOR[kpi.status], background: "rgba(255,255,255,0.04)", border: `1px solid ${STATUS_COLOR[kpi.status]}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}
        >
          {STATUS_LABEL[kpi.status]}
        </span>
      </div>
      {(kpi.target || kpi.actual) && (
        <p className="mono" style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          {kpi.actual || "—"} <span style={{ opacity: 0.6 }}>/ target {kpi.target || "—"}</span>
        </p>
      )}
      {kpi.note && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{kpi.note}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="button" onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>
          Edit
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteScorecardKpi(kpi.id);
              onChanged();
            })
          }
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}
        >
          Delete
        </button>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

export default function ScorecardKpiQuadrant({
  perspective,
  title,
  accentColor,
  description,
  kpis,
}: {
  perspective: ScorecardPerspective;
  title: string;
  accentColor: string;
  description: string;
  kpis: ScorecardKpi[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, borderTop: `3px solid ${accentColor}` }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{description}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {kpis.length === 0 && !adding && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No KPIs added yet.</p>}
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} onChanged={refresh} />
        ))}
      </div>

      {adding ? (
        <KpiForm
          initial={EMPTY_FIELDS}
          isPending={isPending}
          onCancel={() => setAdding(false)}
          onSave={(fields) =>
            startTransition(async () => {
              setError(null);
              const result = await createScorecardKpi(perspective, fields);
              if (result?.error) setError(result.error);
              else {
                setAdding(false);
                refresh();
              }
            })
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: accentColor, cursor: "pointer" }}
        >
          + Add KPI
        </button>
      )}
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
