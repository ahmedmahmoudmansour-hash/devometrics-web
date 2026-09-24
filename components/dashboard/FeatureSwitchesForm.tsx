"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { COMPANY_TILES, SWITCHABLE_FEATURE_KEYS } from "@/lib/organizations/companyTiles";
import { setDisabledCompanyFeatures } from "@/lib/organizations/companyFeatures";

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        background: on ? "var(--teal)" : "rgba(255,255,255,0.18)",
        opacity: disabled ? 0.45 : 1,
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", display: "block" }} />
    </button>
  );
}

// The admin's control panel for the company hub: one switch per tile (all
// of its features at once) and one per feature. Saves on every flip, like
// the other settings toggles. Locked features (Settings, Permissions,
// Employees, this page) stay on so the workspace can't lock itself out.
export default function FeatureSwitchesForm({ organizationId, initialDisabled }: { organizationId: string; initialDisabled: string[] }) {
  const t = useTranslations("companyHub");
  const tNav = useTranslations("companyNavTabs");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [disabled, setDisabled] = useState<Set<string>>(new Set(initialDisabled.filter((k) => (SWITCHABLE_FEATURE_KEYS as string[]).includes(k))));
  const [error, setError] = useState<string | null>(null);

  function save(next: Set<string>) {
    const previous = disabled;
    setDisabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setDisabledCompanyFeatures(organizationId, [...next]);
      if ("error" in result) {
        setDisabled(previous);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function toggleFeature(key: string, on: boolean) {
    const next = new Set(disabled);
    if (on) next.delete(key);
    else next.add(key);
    save(next);
  }

  function toggleTile(keys: string[], on: boolean) {
    const next = new Set(disabled);
    for (const k of keys) {
      if (on) next.delete(k);
      else next.add(k);
    }
    save(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
      {COMPANY_TILES.map((tile) => {
        const switchable = tile.features.filter((f) => !f.locked).map((f) => f.key as string);
        const tileOn = switchable.length === 0 || switchable.some((k) => !disabled.has(k));
        return (
          <section key={tile.key} style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>{tNav(`group_${tile.key}`)}</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.5 }}>{t(`tile_${tile.key}`)}</p>
              </div>
              {switchable.length > 0 ? (
                <Switch on={tileOn} disabled={isPending} onChange={(on) => toggleTile(switchable, on)} label={tNav(`group_${tile.key}`)} />
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("alwaysOn")}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              {tile.features.map((f) => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{tNav(f.key)}</p>
                    {f.employeeFeature && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{t("alsoHidesFromEmployees")}</p>}
                  </div>
                  {f.locked ? (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("alwaysOn")}</span>
                  ) : (
                    <Switch on={!disabled.has(f.key)} disabled={isPending} onChange={(on) => toggleFeature(f.key, on)} label={tNav(f.key)} />
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
