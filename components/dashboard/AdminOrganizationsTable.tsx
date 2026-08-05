"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateOrgSeatLimit, updateOrgAiBudget, getOrgMemberAiSpend, setOrganizationDisabled } from "@/lib/admin/organizations";
import type { AdminOrganizationRow, OrgMemberSpendRow } from "@/lib/admin/organizations";

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
          border: `1px solid ${overLimit ? "#f87171" : "var(--border)"}`,
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 12,
          color: "var(--text)",
          outline: "none",
        }}
      />
      {overLimit && <span style={{ fontSize: 10.5, color: "#f87171", fontWeight: 700 }}>{t("overLabel")}</span>}
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
    </div>
  );
}

function AiBudgetCell({ org }: { org: AdminOrganizationRow }) {
  const t = useTranslations("adminOrganizationsTable");
  const router = useRouter();
  const [value, setValue] = useState(org.monthlyAiBudgetUsd === null ? "" : String(org.monthlyAiBudgetUsd));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed === org.monthlyAiBudgetUsd) return;
    startTransition(async () => {
      const result = await updateOrgAiBudget(org.id, parsed);
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
    return <p style={{ fontSize: 12, color: "#f87171", padding: "10px 14px" }}>{error}</p>;
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
          background: isDisabled ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.05)",
          border: "1px solid " + (isDisabled ? "rgba(248,113,113,0.4)" : "var(--border)"),
          borderRadius: 6,
          padding: "5px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: isDisabled ? "#f87171" : "var(--text)",
          cursor: "pointer",
        }}
      >
        {isPending ? t("accessUpdating") : isDisabled ? t("accessDisabledLabel") : t("accessEnabledLabel")}
      </button>
      {error && <span style={{ fontSize: 10.5, color: "#f87171" }}>{error}</span>}
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
                  <td style={{ ...cellStyle, textAlign: "right", color: overBudget ? "#f87171" : "var(--text)", fontWeight: overBudget ? 700 : 400 }}>
                    ${org.spendThisMonthUsd.toFixed(2)}
                  </td>
                  <td style={cellStyle}>
                    <AiBudgetCell org={org} />
                  </td>
                  <td style={cellStyle}>
                    <OrgAccessCell org={org} />
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
                    <td colSpan={7} style={{ padding: 0, borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
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
