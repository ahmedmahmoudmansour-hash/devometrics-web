"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  updateProfileAiBudget,
  updateUserSubscriptionTier,
  platformAdminScheduleDataDeletion,
  platformAdminCancelDataDeletion,
} from "@/lib/admin/profiles";
import type { PilotRow } from "@/lib/admin/aggregate";
import type { SubscriptionTier } from "@/lib/billing/subscriptionTier";

const cellStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
};
const headStyle: React.CSSProperties = {
  ...cellStyle,
  color: "var(--text-muted)",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border)",
};

function AiBudgetCell({ row }: { row: PilotRow }) {
  const t = useTranslations("adminPilotTable");
  const router = useRouter();
  const [value, setValue] = useState(row.monthlyAiBudgetUsd === null ? "" : String(row.monthlyAiBudgetUsd));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed === row.monthlyAiBudgetUsd) return;
    startTransition(async () => {
      const result = await updateProfileAiBudget(row.userId, parsed);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>$</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder={t("unlimitedPlaceholder")}
        disabled={isPending}
        style={{
          width: 90,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--text)",
          outline: "none",
        }}
      />
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
    </div>
  );
}

function SubscriptionTierCell({ row }: { row: PilotRow }) {
  const t = useTranslations("adminPilotTable");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(tier: SubscriptionTier) {
    setError(null);
    if (tier === row.subscriptionTier) return;
    startTransition(async () => {
      const result = await updateUserSubscriptionTier(row.userId, tier);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  // Stored tier can differ from what actually applies right now (e.g. a
  // 'premium' trial that already expired reads as 'free' in practice) —
  // effectiveTier surfaces that instead of hiding it behind the dropdown.
  const trialLapsed = row.subscriptionTier !== "free" && row.effectiveTier === "free";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select
        value={row.subscriptionTier}
        onChange={(e) => save(e.target.value as SubscriptionTier)}
        disabled={isPending}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--text)",
          outline: "none",
        }}
      >
        <option value="free">{t("tierFree")}</option>
        <option value="premium">{t("tierPremium")}</option>
        <option value="enterprise">{t("tierEnterprise")}</option>
      </select>
      {trialLapsed && (
        <span style={{ fontSize: 10.5, color: "var(--text-muted)" }} title={t("trialExpiredTitle")}>
          {t("trialExpiredLabel")}
        </span>
      )}
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
    </div>
  );
}

// Platform-admin equivalent of DeleteCompanyButton's own three-state
// pattern (default -> type-to-confirm -> scheduled), condensed to fit a
// table cell. Wipes the user's activity/content via the same 30-day
// grace-period mechanism as their own self-service "delete my data" —
// it does not remove their login, which this app has no service-role key
// to do server-side.
function DataDeletionCell({ row }: { row: PilotRow }) {
  const t = useTranslations("adminPilotTable");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scheduledFor, setScheduledFor] = useState(row.pendingDataDeletionAt);
  const matches = confirmText.trim().toLowerCase() === row.email.toLowerCase();

  if (scheduledFor) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>
          {t("dataScheduled", { date: new Date(scheduledFor).toLocaleDateString() })}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await platformAdminCancelDataDeletion(row.userId);
              if ("error" in result) setError(result.error);
              else {
                setScheduledFor(null);
                router.refresh();
              }
            })
          }
          style={{ background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 700, color: "var(--teal)", cursor: "pointer" }}
        >
          {isPending ? t("dataCancelling") : t("dataCancelButton")}
        </button>
        {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{ background: "none", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#f87171", cursor: "pointer" }}
      >
        {t("dataDeleteButton")}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={row.email}
        aria-label={t("dataConfirmAria", { email: row.email })}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "var(--text)", outline: "none" }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={isPending || !matches}
          onClick={() =>
            startTransition(async () => {
              const result = await platformAdminScheduleDataDeletion(row.userId);
              if ("error" in result) setError(result.error);
              else {
                setScheduledFor(result.deletionAt);
                router.refresh();
              }
            })
          }
          style={{
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.4)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#f87171",
            cursor: matches ? "pointer" : "not-allowed",
            opacity: isPending || !matches ? 0.5 : 1,
          }}
        >
          {isPending ? t("dataScheduling") : t("dataConfirmButton")}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
          }}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
        >
          {t("dataCancelButton")}
        </button>
      </div>
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
    </div>
  );
}

export default function AdminPilotTable({ initial }: { initial: PilotRow[] }) {
  const t = useTranslations("adminPilotTable");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colName")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colEmail")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colOrganization")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colSubscription")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colCareerHealthScore")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colAssessments")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colPlans")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colMilestones")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colJoined")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colAiSpendThisMonth")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colMonthlyAiBudget")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colData")}</th>
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 ? (
              <tr>
                <td style={cellStyle} colSpan={12}>
                  {t("noParticipants")}
                </td>
              </tr>
            ) : (
              initial.map((r) => {
                const overBudget = r.monthlyAiBudgetUsd !== null && r.spendThisMonthUsd >= r.monthlyAiBudgetUsd;
                return (
                  <tr key={r.userId}>
                    <td style={cellStyle}>{r.name}</td>
                    <td style={cellStyle}>{r.email}</td>
                    <td style={{ ...cellStyle, color: r.organizationName ? "var(--text)" : "var(--text-muted)" }}>
                      {r.organizationName ?? t("individualLabel")}
                    </td>
                    <td style={cellStyle}>
                      <SubscriptionTierCell row={r} />
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right", color: "var(--teal)", fontWeight: 700 }}>
                      {r.careerHealthScore ?? "—"}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {r.assessmentsCompleted}/{r.totalAssessments}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>{r.plans}</td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {r.milestonesDone}/{r.milestonesTotal}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {new Date(r.joined).toLocaleDateString(dateLocale)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right", color: overBudget ? "#f87171" : "var(--text)", fontWeight: overBudget ? 700 : 400 }}>
                      ${r.spendThisMonthUsd.toFixed(2)}
                    </td>
                    <td style={cellStyle}>
                      <AiBudgetCell row={r} />
                    </td>
                    <td style={cellStyle}>
                      <DataDeletionCell row={r} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
