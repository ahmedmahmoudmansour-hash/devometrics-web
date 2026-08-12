"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createSavedView, deleteSavedView, type OrgChartSavedView, type SavedOrgChartConfig } from "@/lib/orgChart/savedViews";
import type { OrgChartViewConfig, OrgChartPresetKey } from "@/lib/orgChart/cardConfig";

export default function OrgChartSavedViewsMenu({
  savedViews,
  currentConfig,
  currentPresetKey,
  onApply,
  onSaved,
}: {
  savedViews: OrgChartSavedView[];
  currentConfig: OrgChartViewConfig;
  currentPresetKey: OrgChartPresetKey | null;
  onApply: (view: OrgChartSavedView) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("orgChartSavedViews");
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("nameRequired"));
      return;
    }
    const config: SavedOrgChartConfig = { ...currentConfig, presetKey: currentPresetKey };
    startTransition(async () => {
      const result = await createSavedView(trimmed, config);
      if (result?.error) setError(result.error);
      else {
        setName("");
        setSaveDialogOpen(false);
        onSaved();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteSavedView(id);
      onSaved();
    });
  }

  return (
    <div className="no-print" style={{ position: "relative", display: "inline-flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "var(--text)", cursor: "pointer" }}
      >
        {t("savedViews")} {savedViews.length > 0 ? `(${savedViews.length})` : ""}
      </button>
      <button
        type="button"
        onClick={() => setSaveDialogOpen(true)}
        style={{ background: "rgba(var(--teal-rgb),0.1)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
      >
        {t("saveCurrentView")}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 20, minWidth: 260, background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
          {savedViews.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 6 }}>{t("noneYet")}</p>
          ) : (
            savedViews.map((view) => (
              <div key={view.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "6px 4px", borderBottom: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    onApply(view);
                    setOpen(false);
                  }}
                  style={{ background: "none", border: "none", color: "var(--text)", fontSize: 12.5, textAlign: "left", flex: 1, cursor: "pointer" }}
                >
                  {view.name}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => remove(view.id)}
                  style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11, cursor: "pointer" }}
                >
                  {t("delete")}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {saveDialogOpen && (
        <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 20, width: 280, background: "var(--navy-mid)", border: "1px solid rgba(var(--teal-rgb),0.3)", borderRadius: 10, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{t("nameLabel")}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--text)", outline: "none" }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 6 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              style={{ background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSaveDialogOpen(false);
                setError(null);
              }}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer" }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
