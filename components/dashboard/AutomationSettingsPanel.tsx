"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateAutomationSetting } from "@/lib/automations/actions";
import { RECIPES, type RecipeKey } from "@/lib/automations/catalog";

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      style={{
        width: 40,
        height: 22,
        borderRadius: 100,
        border: "1px solid var(--border)",
        background: checked ? "var(--teal)" : "var(--navy-light)",
        position: "relative",
        cursor: disabled ? "wait" : "pointer",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <span
        style={{
          position: "absolute",
          insetBlockStart: 2,
          insetInlineStart: checked ? 19 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: checked ? "#0A0F1E" : "var(--text-muted)",
          transition: "inset-inline-start 0.2s ease",
        }}
      />
    </button>
  );
}

export default function AutomationSettingsPanel({
  organizationId,
  initialSettings,
}: {
  organizationId: string;
  initialSettings: Record<RecipeKey, boolean>;
}) {
  const t = useTranslations("workflowAutomation");
  const [settings, setSettings] = useState(initialSettings);
  const [pendingKey, setPendingKey] = useState<RecipeKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(key: RecipeKey) {
    const next = !settings[key];
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const result = await updateAutomationSetting(organizationId, key, next);
      if (result?.error) {
        setError(result.error);
      } else {
        setSettings((prev) => ({ ...prev, [key]: next }));
      }
      setPendingKey(null);
    });
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("title")}</h2>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, marginBottom: 16, lineHeight: 1.5 }}>
        {t("description")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {RECIPES.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            <ToggleSwitch checked={settings[r.key]} onChange={() => toggle(r.key)} disabled={pendingKey === r.key} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t(`recipes.${r.key}.title`)}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{t(`recipes.${r.key}.description`)}</p>
            </div>
          </div>
        ))}
      </div>
      {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
