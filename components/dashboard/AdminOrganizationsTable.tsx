"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  updateOrgSeatLimit,
  updateOrgAiBudget,
  getOrgMemberAiSpend,
  setOrganizationDisabled,
  platformAdminScheduleOrganizationDeletion,
  platformAdminCancelOrganizationDeletion,
} from "@/lib/admin/organizations";
import type { AdminOrganizationRow, OrgMemberSpendRow } from "@/lib/admin/organizations";
import { AI_BUDGET_PACKAGES, packageBudgetForSeats } from "@/lib/aiUsage/budgetPackages";

const cellStyle: React.CSSProperties = {
  padding: "10px 14px",
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

function SeatLimitCell({ org }: { org: AdminOrganizationRow }) {
  const t = useTranslations("adminOrganizationsTable");
  const router = useRouter();
  const [value, setValue] = useState(org.seatLimit === null ? "" : String(org.seatLimit));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const overLimit = org.seatLimit !== null && org.memberCount > org.seatLimit;

  function save() {
    setError(null);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed === org.seatLimit) return;
    startTransition(async () => {
      const result = await updateOrgSeatLimit(org.id, parsed);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder={t("unlimitedPlaceholder")}
        disabled={isPending}
        style={{
          width: 80,
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${overLimit ? "var(--danger)" : "var(--border)"}`,
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--text)",
          outline: "none",
        }}
      />
      {overLimit && <span style={{ fontSize: 10.5, color: "var(--danger)", fontWeight: 700 }}>{t("overLabel")}</span>}
      {error && <span style={{ fontSize: 10.5, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

function AiBudgetCell({ org }: { org: AdminOrganizationRow }) {
  const t = useTranslations("adminOrganizationsTable");
  const router = useRouter();
  const [value, setValue] = useState(org.monthlyAiBudgetUsd === null ? "" : String(org.monthlyAiBudgetUsd));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function commit(newValue: string) {
    setError(null);
    const trimmed = newValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed === org.monthlyAiBudgetUsd) return;
    startTransition(async () => {
      const result = await updateOrgAiBudget(org.id, parsed);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  // Seat count actually used to size a package: the higher of seatLimit
  // (what was sold) and memberCount (who's actually there) — a deal sized
  // for 20 seats that's grown to 25 real members shouldn't get a budget
  // computed off the stale, smaller number.
  const seats = Math.max(org.seatLimit ?? 0, org.memberCount, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>$</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit(value)}
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
        {error && <span style={{ fontSize: 10.5, color: "var(--danger)" }}>{error}</span>}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {AI_BUDGET_PACKAGES.map((pkg) => {
          const amount = packageBudgetForSeats(pkg.perSeatUsd, seats);
          return (
            <button
              key={pkg.id}
              type="button"
              title={t("packageTooltip", { perSeat: pkg.perSeatUsd.toFixed(2), seats })}
              disabled={isPending}
              onClick={() => {
                setValue(String(amount));
                commit(String(amount));
              }}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 5,
                padding: "2px 6px",
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t(`package_${pkg.id}`)} ${amount}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Per-employee dollar breakdown — platform-admin eyes only, never a
// company's own org-admin or its employees (see migration 0093's comment).
// Fetched on demand per org, not eagerly for every row, since this is a
// drill-down most admins won't open for most companies most of the time.
function EmployeeSpendPanel({ organizationId }: { organizationId: string }) {
  const t = useTranslations("adminOrganizationsTable");
  const [rows, setRows] = useState<OrgMemberSpendRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrgMemberAiSpend(organizationId)
      .then((result) => {
        if (cancelled) return;
        if (!result.isAdmin) {
          setError(t("notAuthorized"));
        } else {
          setRows(result.rows);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("couldNotLoadSpend"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, t]);

  if (loading) {
    return <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 14px" }}>{t("loadingEllipsis")}</p>;
  }
  if (error) {
    return <p style={{ fontSize: 12, color: "var(--danger)", padding: "10px 14px" }}>{error}</p>;
  }
  if (!rows || rows.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 14px" }}>{t("noUsageThisMonth")}</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ ...headStyle, textAlign: "left", background: "transparent" }}>{t("colEmployee")}</th>
          <th style={{ ...headStyle, textAlign: "left", background: "transparent" }}>{t("colEmail")}</th>
          <th style={{ ...headStyle, textAlign: "right", background: "transparent" }}>{t("colSpendThisMonth")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.userId}>
            <td style={cellStyle}>{r.name}</td>
            <td style={cellStyle}>{r.email}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>${r.spendThisMonthUsd.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Blocks/restores every member of the workspace at once — separate from
// AdminPilotTable's per-user AccessCell, which only ever affects one
// person. Same instant-reversibility posture (plain confirm(), not
// type-to-confirm): flip it back any time.
function OrgAccessCell({ org }: { org: AdminOrganizationRow }) {
  const t = useTranslations("adminOrganizationsTable");
  const router = useRouter();
  const [isDisabled, setIsDisabled] = useState(org.isDisabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !isDisabled;
    if (next && !window.confirm(t("accessDisableConfirm", { name: org.name }))) return;
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationDisabled(org.id, next);
      if ("error" in result) setError(result.error);
      else {
        setIsDisabled(next);
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        disabled={isPending}
        onClick={toggle}
        style={{
          background: isDisabled ? "rgba(var(--danger-rgb),0.12)" : "rgba(255,255,255,0.05)",
          border: "1px solid " + (isDisabled ? "rgba(var(--danger-rgb),0.4)" : "var(--border)"),
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: isDisabled ? "var(--danger)" : "var(--text)",
          cursor: "pointer",
        }}
      >
        {isPending ? t("accessUpdating") : isDisabled ? t("accessDisabledLabel") : t("accessEnabledLabel")}
      </button>
      {error && <span style={{ fontSize: 10.5, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

// Platform-wide company cleanup — same 30-day grace period and
// cancel-any-time posture as everything else that touches
// pending_deletion_at (see migration 0119), so a mistaken click on the
// wrong test company is still recoverable. Deliberately a plain confirm()
// naming the company, not type-to-confirm — this schedules a reversible
// grace period, it doesn't delete anything immediately.
function DeleteOrgCell({ org }: { org: AdminOrganizationRow }) {
  const t = useTranslations("adminOrganizationsTable");
  const router = useRouter();
  const [pendingDeletionAt, setPendingDeletionAt] = useState(org.pendingDeletionAt);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function scheduleDelete() {
    if (!window.confirm(t("deleteConfirm", { name: org.name }))) return;
    setError(null);
    startTransition(async () => {
      const result = await platformAdminScheduleOrganizationDeletion(org.id);
      if ("error" in result) setError(result.error);
      else {
        setPendingDeletionAt(result.deletionAt);
        router.refresh();
      }
    });
  }

  function cancelDelete() {
    setError(null);
    startTransition(async () => {
      const result = await platformAdminCancelOrganizationDeletion(org.id);
      if ("error" in result) setError(result.error);
      else {
        setPendingDeletionAt(null);
        router.refresh();
      }
    });
  }

  if (pendingDeletionAt) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 10.5, color: "var(--danger)" }}>
          {t("deletionScheduledFor", { date: new Date(pendingDeletionAt).toLocaleDateString() })}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={cancelDelete}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          {isPending ? t("accessUpdating") : t("cancelDeleteButton")}
        </button>
        {error && <span style={{ fontSize: 10.5, color: "var(--danger)" }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        disabled={isPending}
        onClick={scheduleDelete}
        style={{
          background: "transparent",
          border: "1px solid rgba(var(--danger-rgb),0.4)",
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--danger)",
          cursor: "pointer",
        }}
      >
        {isPending ? t("accessUpdating") : t("deleteButton")}
      </button>
      {error && <span style={{ fontSize: 10.5, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

export default function AdminOrganizationsTable({ initial }: { initial: AdminOrganizationRow[] }) {
  const t = useTranslations("adminOrganizationsTable");
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);

  if (initial.length === 0) {
    return (
      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("noWorkspacesYet")}</p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t("sectionTitle")}</h2>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
          {t("sectionDescription")}
        </p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colOrganization")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colMembers")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colSeatLimit")}</th>
              <th style={{ ...headStyle, textAlign: "right" }}>{t("colAiSpendThisMonth")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colMonthlyAiBudget")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colAccess")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}>{t("colDelete")}</th>
              <th style={{ ...headStyle, textAlign: "left" }}></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((org) => {
              const overBudget = org.monthlyAiBudgetUsd !== null && org.spendThisMonthUsd >= org.monthlyAiBudgetUsd;
              const isExpanded = expandedOrgId === org.id;
              return (
                <Fragment key={org.id}>
                <tr>
                  <td style={cellStyle}>{org.name}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>{org.memberCount}</td>
                  <td style={cellStyle}>
                    <SeatLimitCell org={org} />
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", color: overBudget ? "var(--danger)" : "var(--text)", fontWeight: overBudget ? 700 : 400 }}>
                    ${org.spendThisMonthUsd.toFixed(2)}
                  </td>
                  <td style={cellStyle}>
                    <AiBudgetCell org={org} />
                  </td>
                  <td style={cellStyle}>
                    <OrgAccessCell org={org} />
                  </td>
                  <td style={cellStyle}>
                    <DeleteOrgCell org={org} />
                  </td>
                  <td style={cellStyle}>
                    <button
                      type="button"
                      onClick={() => setExpandedOrgId(isExpanded ? null : org.id)}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? t("hideButton") : t("byEmployeeButton")}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0, borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                      <EmployeeSpendPanel organizationId={org.id} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
