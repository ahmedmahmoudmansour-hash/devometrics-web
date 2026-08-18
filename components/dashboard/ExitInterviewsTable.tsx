"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import DeleteExitInterviewButton from "@/components/dashboard/DeleteExitInterviewButton";
import type { ExitInterview, SeparationType } from "@/lib/exitInterviews/types";

const cellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  verticalAlign: "top",
};
const headStyle: React.CSSProperties = {
  ...cellStyle,
  color: "var(--text-muted)",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 12.5,
  color: "var(--text)",
  cursor: "pointer",
};

const SEPARATION_TYPES: SeparationType[] = ["voluntary", "involuntary", "other"];

// Client-side filtering over the already-loaded list — matches the exact
// department/separation-type breakdown the AI analysis panel above this
// table already groups by, so the two stay conceptually aligned.
export default function ExitInterviewsTable({ interviews }: { interviews: ExitInterview[] }) {
  const t = useTranslations("exitInterviewsPage");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [separationFilter, setSeparationFilter] = useState<SeparationType | "all">("all");

  const departments = useMemo(
    () => [...new Set(interviews.map((iv) => iv.department).filter((d): d is string => !!d))].sort(),
    [interviews]
  );

  const filtered = interviews.filter(
    (iv) => (departmentFilter === "all" || iv.department === departmentFilter) && (separationFilter === "all" || iv.separation_type === separationFilter)
  );

  return (
    <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      {departments.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px 14px 0" }}>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={selectStyle}>
            <option value="all">{t("allDepartments")}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select value={separationFilter} onChange={(e) => setSeparationFilter(e.target.value as SeparationType | "all")} style={selectStyle}>
            <option value="all">{t("allSeparationTypes")}</option>
            {SEPARATION_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`separation${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14, padding: 24 }}>{t("noInterviewsMatchFilter")}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...headStyle, textAlign: "left" }}>{t("colName")}</th>
                <th style={{ ...headStyle, textAlign: "left" }}>{t("colDepartment")}</th>
                <th style={{ ...headStyle, textAlign: "left" }}>{t("colSeparationType")}</th>
                <th style={{ ...headStyle, textAlign: "left", whiteSpace: "nowrap" }}>{t("colLastDay")}</th>
                <th style={{ ...headStyle, textAlign: "left" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((iv) => (
                <tr key={iv.id}>
                  <td style={cellStyle}>{iv.employee_name}</td>
                  <td style={{ ...cellStyle, color: iv.department ? "var(--text)" : "var(--text-muted)" }}>{iv.department ?? "—"}</td>
                  <td style={cellStyle}>{t(`separation${iv.separation_type.charAt(0).toUpperCase()}${iv.separation_type.slice(1)}`)}</td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                    {iv.last_day ? new Date(iv.last_day).toLocaleDateString() : "—"}
                  </td>
                  <td style={cellStyle}>
                    <DeleteExitInterviewButton id={iv.id} label={t("deleteButton")} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
