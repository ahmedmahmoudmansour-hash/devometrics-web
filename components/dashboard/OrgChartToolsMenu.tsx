"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import OrgChartSavedViewsMenu from "@/components/dashboard/OrgChartSavedViewsMenu";
import OrgChartSnapshotControls from "@/components/dashboard/OrgChartSnapshotControls";
import type { OrgChartSavedView } from "@/lib/orgChart/savedViews";
import type { OrgChartViewConfig, OrgChartPresetKey } from "@/lib/orgChart/cardConfig";

// UX audit fix — the toolbar used to show up to 8 separate buttons at once
// (2 for saved views, 2 for add-position, 3 for snapshots, 1 for export),
// which crowded and wrapped awkwardly below desktop width. This collapses
// the two lower-frequency groups (display views, structure snapshots)
// behind one entry point; both child components are used completely
// unmodified internally (their own trigger buttons and dialogs still work
// exactly as before), just nested one level deeper visually.
export default function OrgChartToolsMenu({
  savedViews,
  currentConfig,
  currentPresetKey,
  onApply,
  onSaved,
  organizationName,
}: {
  savedViews: OrgChartSavedView[];
  currentConfig: OrgChartViewConfig;
  currentPresetKey: OrgChartPresetKey | null;
  onApply: (view: OrgChartSavedView) => void;
  onSaved: () => void;
  organizationName: string;
}) {
  const t = useTranslations("orgChartToolsMenu");
  const [open, setOpen] = useState(false);

  return (
    <div className="no-print" style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "var(--text)", cursor: "pointer" }}
      >
        {t("chartTools")} {open ? "▴" : "▾"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            zIndex: 25,
            minWidth: 340,
            background: "var(--navy-mid)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 14,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              {t("displayViewsLabel")}
            </p>
            <OrgChartSavedViewsMenu
              savedViews={savedViews}
              currentConfig={currentConfig}
              currentPresetKey={currentPresetKey}
              onApply={onApply}
              onSaved={onSaved}
            />
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              {t("structureSnapshotsLabel")}
            </p>
            <OrgChartSnapshotControls organizationName={organizationName} />
          </div>
        </div>
      )}
    </div>
  );
}
