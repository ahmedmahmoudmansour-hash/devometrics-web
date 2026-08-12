"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createOrgChartSnapshot,
  listOrgChartSnapshots,
  getOrgChartSnapshotDetail,
  type OrgChartSnapshotSummary,
  type OrgChartSnapshotDetail,
} from "@/lib/orgChart/snapshots";
import { resetOrgChart } from "@/lib/orgChart/reset";

const RESET_CONFIRM_WORD = "RESET";

const buttonStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--text)",
  cursor: "pointer",
};

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

// Deliberately a separate control group from OrgChartSavedViewsMenu — that
// menu only ever stores DISPLAY config (toggles/density/filters), never who
// actually reports to whom (see migration 0121's comment). Conflating the
// two under one "Save" button would silently mislead an admin into thinking
// a display-config save also protects their reporting-line structure.
export default function OrgChartSnapshotControls() {
  const t = useTranslations("orgChartSnapshots");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [listOpen, setListOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<OrgChartSnapshotSummary[] | null>(null);

  const [detail, setDetail] = useState<OrgChartSnapshotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  function openSaveDialog() {
    setSaveError(null);
    setName("");
    setSaveDialogOpen(true);
  }

  function saveSnapshot() {
    setSaveError(null);
    startTransition(async () => {
      const result = await createOrgChartSnapshot(name);
      if ("error" in result) {
        setSaveError(result.error);
        return;
      }
      setSaveDialogOpen(false);
      setSnapshots(null); // force a refetch next time the list opens
    });
  }

  function toggleList() {
    if (listOpen) {
      setListOpen(false);
      return;
    }
    setListOpen(true);
    if (snapshots === null) {
      listOrgChartSnapshots().then(setSnapshots);
    }
  }

  function openDetail(id: string) {
    setDetailLoading(true);
    getOrgChartSnapshotDetail(id)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }

  const hasSnapshotToday = (snapshots ?? []).some((s) => isToday(s.createdAt));

  function doReset() {
    setResetError(null);
    startTransition(async () => {
      const result = await resetOrgChart();
      if ("error" in result) {
        setResetError(result.error);
        return;
      }
      setResetDialogOpen(false);
      setConfirmText("");
      router.refresh();
    });
  }

  return (
    <div className="no-print" style={{ position: "relative", display: "inline-flex", gap: 8 }}>
      <button type="button" style={buttonStyle} onClick={openSaveDialog}>
        {t("saveSnapshot")}
      </button>
      <button type="button" style={buttonStyle} onClick={toggleList}>
        {t("viewSnapshots")} {snapshots && snapshots.length > 0 ? `(${snapshots.length})` : ""}
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, borderColor: "rgba(248,113,113,0.4)", color: "#f87171" }}
        onClick={() => {
          setResetError(null);
          setConfirmText("");
          setResetDialogOpen(true);
          if (snapshots === null) listOrgChartSnapshots().then(setSnapshots);
        }}
      >
        {t("resetChart")}
      </button>

      {saveDialogOpen && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            zIndex: 30,
            width: 300,
            background: "var(--navy-mid)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 10,
            padding: 14,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 10 }}>{t("saveSnapshotHint")}</p>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{t("nameLabel")}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)", outline: "none" }}
          />
          {saveError && <p style={{ color: "#f87171", fontSize: 11.5, marginTop: 6 }}>{saveError}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={saveSnapshot}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={() => setSaveDialogOpen(false)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {listOpen && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            zIndex: 30,
            minWidth: 280,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {snapshots === null ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 6 }}>{t("loading")}</p>
          ) : snapshots.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 6 }}>{t("noneYet")}</p>
          ) : (
            snapshots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setListOpen(false);
                  openDetail(s.id);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  padding: "8px 6px",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text)", fontWeight: 600 }}>{s.name}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                  {t("snapshotMeta", { date: new Date(s.createdAt).toLocaleDateString(), by: s.createdByName ?? t("unknownCreator") })}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {(detail || detailLoading) && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(3,8,16,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, maxWidth: 560, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
          >
            {detailLoading || !detail ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("loading")}</p>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{detail.name}</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>
                  {t("snapshotDetailAsOf", { date: new Date(detail.createdAt).toLocaleString() })}
                </p>
                <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {detail.rows.map((row) => (
                    <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                      <span style={{ color: "var(--text)" }}>
                        {row.label}
                        {row.subtitle ? <span style={{ color: "var(--text-muted)" }}> — {row.subtitle}</span> : null}
                        {row.positionKind ? (
                          <span style={{ color: "var(--text-muted)" }}> — {row.positionKind === "vacant_role" ? t("vacantRole") : t("structural")}</span>
                        ) : null}
                      </span>
                      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{row.managerLabel ?? t("noManager")}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  style={{ marginTop: 16, alignSelf: "flex-end", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer" }}
                >
                  {t("close")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {resetDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(3,8,16,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setResetDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--navy-mid)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 16, padding: 24, maxWidth: 440, width: "100%" }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: "#f87171", marginBottom: 10 }}>{t("resetTitle")}</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 12 }}>{t("resetBody")}</p>
            {!hasSnapshotToday && (
              <p style={{ fontSize: 12.5, color: "var(--amber)", background: "rgba(240,184,64,0.1)", border: "1px solid rgba(240,184,64,0.3)", borderRadius: 8, padding: 10, marginBottom: 12, lineHeight: 1.5 }}>
                {t("resetNoSnapshotNudge")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setResetDialogOpen(false);
                    openSaveDialog();
                  }}
                  style={{ background: "none", border: "none", color: "var(--teal)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12.5, textDecoration: "underline" }}
                >
                  {t("resetSaveOneNow")}
                </button>
              </p>
            )}
            <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              {t("resetConfirmLabel", { word: RESET_CONFIRM_WORD })}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={RESET_CONFIRM_WORD}
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--text)", outline: "none", marginBottom: 12 }}
            />
            {resetError && <p style={{ color: "#f87171", fontSize: 12.5, marginBottom: 10 }}>{resetError}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setResetDialogOpen(false)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={isPending || confirmText.trim() !== RESET_CONFIRM_WORD}
                onClick={doReset}
                style={{
                  background: "rgba(248,113,113,0.15)",
                  border: "1px solid #f87171",
                  borderRadius: 8,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#f87171",
                  cursor: confirmText.trim() === RESET_CONFIRM_WORD ? "pointer" : "not-allowed",
                  opacity: isPending || confirmText.trim() !== RESET_CONFIRM_WORD ? 0.5 : 1,
                }}
              >
                {isPending ? t("resetting") : t("resetButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
