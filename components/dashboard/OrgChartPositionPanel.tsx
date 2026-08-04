"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  updatePosition,
  deletePosition,
  fillPosition,
  listOpenPostingsAndRoles,
  type OrgPositionRow,
  type OrgPositionStatus,
} from "@/lib/orgChart/positions";
import { setPositionParent } from "@/lib/orgChart/actions";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

const STATUS_OPTIONS: Exclude<OrgPositionStatus, "filled">[] = ["open", "future", "frozen"];

export default function OrgChartPositionPanel({
  position,
  rows,
  positions,
  onClose,
}: {
  position: OrgPositionRow;
  rows: WorkforceRow[];
  positions: OrgPositionRow[];
  onClose: () => void;
}) {
  const t = useTranslations("orgChartPositionPanel");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [postings, setPostings] = useState<{ id: string; title: string; status: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; title: string; level: string; grade: number }[]>([]);
  const [fillUserId, setFillUserId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (position.kind !== "vacant_role") return;
    listOpenPostingsAndRoles().then((result) => {
      setPostings(result.postings);
      setRoles(result.roles);
    });
  }, [position.kind]);

  function run(action: () => Promise<{ success: true } | { error: string }>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        onSuccess?.();
      }
    });
  }

  const reportsToValue = position.parentPositionId
    ? `position:${position.parentPositionId}`
    : position.parentMemberUserId
      ? `member:${position.parentMemberUserId}`
      : "";

  function handleReportsToChange(value: string) {
    const [kind, id] = value ? value.split(":") : [null, null];
    run(() => setPositionParent(position.id, kind === "position" ? id : null, kind === "member" ? id : null));
  }

  return (
    <div className="no-print" style={{ marginTop: 16, background: "var(--navy-mid)", border: "1px solid rgba(0,201,167,0.3)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
          {position.kind === "structural" ? t("kindStructural") : t("kindVacant")} — {position.title}
        </span>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
          {t("close")}
        </button>
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label={t("title")}>
          <input
            defaultValue={position.title}
            disabled={isPending}
            onBlur={(e) => e.target.value.trim() !== position.title && run(() => updatePosition(position.id, { title: e.target.value }))}
            style={inputStyle()}
          />
        </Field>
        <Field label={t("department")}>
          <input
            defaultValue={position.department ?? ""}
            disabled={isPending}
            onBlur={(e) => run(() => updatePosition(position.id, { department: e.target.value || null }))}
            style={inputStyle()}
          />
        </Field>
        <Field label={t("businessUnit")}>
          <input
            defaultValue={position.businessUnit ?? ""}
            disabled={isPending}
            onBlur={(e) => run(() => updatePosition(position.id, { businessUnit: e.target.value || null }))}
            style={inputStyle()}
          />
        </Field>
        <Field label={t("country")}>
          <input
            defaultValue={position.country ?? ""}
            disabled={isPending}
            onBlur={(e) => run(() => updatePosition(position.id, { country: e.target.value || null }))}
            style={inputStyle()}
          />
        </Field>
        <Field label={t("location")}>
          <input
            defaultValue={position.location ?? ""}
            disabled={isPending}
            onBlur={(e) => run(() => updatePosition(position.id, { location: e.target.value || null }))}
            style={inputStyle()}
          />
        </Field>
        <Field label={t("headcount")}>
          <input
            type="number"
            min={0}
            defaultValue={position.headcount ?? ""}
            disabled={isPending}
            onBlur={(e) => {
              const trimmed = e.target.value.trim();
              run(() => updatePosition(position.id, { headcount: trimmed === "" ? null : Math.max(0, Number(trimmed)) }));
            }}
            style={inputStyle()}
          />
        </Field>
      </div>

      <Field label={t("details")}>
        <textarea
          defaultValue={position.details ?? ""}
          disabled={isPending}
          rows={3}
          onBlur={(e) => run(() => updatePosition(position.id, { details: e.target.value || null }))}
          style={{ ...inputStyle(), resize: "vertical" }}
        />
      </Field>

      <Field label={t("reportsTo")}>
        <select disabled={isPending} value={reportsToValue} onChange={(e) => handleReportsToChange(e.target.value)} style={inputStyle()}>
          <option value="">{t("noParentOption")}</option>
          {rows.map((r) => (
            <option key={`member:${r.userId}`} value={`member:${r.userId}`}>
              {r.name}
              {r.title ? ` — ${r.title}` : ""}
            </option>
          ))}
          {positions
            .filter((p) => p.id !== position.id)
            .map((p) => (
              <option key={`position:${p.id}`} value={`position:${p.id}`}>
                {p.title} ({p.kind === "structural" ? t("kindStructural") : t("kindVacant")})
              </option>
            ))}
        </select>
      </Field>

      {position.kind === "vacant_role" && (
        <>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <label style={labelTextStyle()}>{t("status")}</label>
              <span
                title={t("statusLegend")}
                style={{
                  fontSize: 10.5,
                  color: "var(--text-muted)",
                  cursor: "help",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: 14,
                  height: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ?
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => updatePosition(position.id, { status: s }))}
                  style={{
                    padding: "5px 11px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    borderRadius: 999,
                    border: position.status === s ? "1px solid var(--teal)" : "1px solid var(--border)",
                    background: position.status === s ? "rgba(0,201,167,0.1)" : "transparent",
                    color: position.status === s ? "var(--teal)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {t(`status_${s}`)}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{t(`statusHint_${position.status}`)}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <Field label={t("linkedPosting")}>
              <select
                disabled={isPending}
                value={position.linkedPostingId ?? ""}
                onChange={(e) => run(() => updatePosition(position.id, { linkedPostingId: e.target.value || null }))}
                style={inputStyle()}
              >
                <option value="">{t("linkedPostingNone")}</option>
                {postings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("linkedRole")}>
              <select
                disabled={isPending}
                value={position.linkedRoleId ?? ""}
                onChange={(e) => run(() => updatePosition(position.id, { linkedRoleId: e.target.value || null }))}
                style={inputStyle()}
              >
                <option value="">{t("linkedRoleNone")}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} (G{r.grade})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <label style={labelTextStyle()}>{t("fillPositionAction")}</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select disabled={isPending} value={fillUserId} onChange={(e) => setFillUserId(e.target.value)} style={inputStyle()}>
                <option value="">{t("fillPositionPicker")}</option>
                {rows.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name}
                    {r.title ? ` — ${r.title}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isPending || !fillUserId}
                onClick={() => run(() => fillPosition(position.id, fillUserId), onClose)}
                style={primaryButtonStyle(isPending || !fillUserId)}
              >
                {t("fillPositionAction")}
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        {confirmingDelete ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("confirmDeletePosition")}</span>
            <button type="button" disabled={isPending} onClick={() => run(() => deletePosition(position.id), onClose)} style={dangerButtonStyle()}>
              {t("deletePosition")}
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            style={{ background: "none", border: "1px solid #f87171", color: "#f87171", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
          >
            {t("deletePosition")}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelTextStyle()}>{label}</label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function labelTextStyle(): React.CSSProperties {
  return { fontSize: 11, color: "var(--text-muted)", display: "block" };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 12.5,
    color: "var(--text)",
    outline: "none",
  };
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "rgba(0,201,167,0.15)" : "var(--teal)",
    color: disabled ? "var(--text-muted)" : "#0A0F1E",
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function dangerButtonStyle(): React.CSSProperties {
  return { background: "#f87171", color: "#1a0505", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
}
