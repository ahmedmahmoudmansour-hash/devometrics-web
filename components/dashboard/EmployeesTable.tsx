"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { bulkAssignAssessment, bulkAssignMilestone } from "@/lib/organizations/actions";
import { buildAssignableCatalog } from "@/lib/assessments/assignableCatalog";
import Avatar from "@/components/Avatar";
import EditEmployeeButton from "@/components/dashboard/EditEmployeeButton";
import type { WorkforceRow } from "@/lib/organizations/aggregate";

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

// Extracted from the Employees page (previously a plain server-rendered
// table) specifically to hold client-side checkbox selection state for
// bulk-assigning a specific assessment to several specific employees at
// once — every other section on that page (heatmap, pyramid, leadership
// ranking) stays server-rendered, untouched.
export default function EmployeesTable({ rows, currentUserId }: { rows: WorkforceRow[]; currentUserId: string | null }) {
  const t = useTranslations("companyEmployeesPage");
  const tCatalog = useTranslations("assessmentCatalog");
  const tExercise = useTranslations("caseStudyExercises");
  const assignable = useMemo(() => buildAssignableCatalog(tCatalog, tExercise), [tCatalog, tExercise]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assessmentSlug, setAssessmentSlug] = useState(assignable[0]?.slug ?? "");
  const [assessmentDueDate, setAssessmentDueDate] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneTargetDate, setMilestoneTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleRow(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.userId)));
  }

  function handleBulkAssign() {
    if (selected.size === 0 || !assessmentSlug) return;
    setError(null);
    setConfirmation(null);
    startTransition(async () => {
      const result = await bulkAssignAssessment([...selected], assessmentSlug, assessmentDueDate || null);
      if ("error" in result) {
        setError(result.error);
      } else {
        setConfirmation(t("bulkAssignConfirmation", { count: result.assigned }));
        setSelected(new Set());
        setAssessmentDueDate("");
      }
    });
  }

  function handleBulkAssignMilestone() {
    if (selected.size === 0 || !milestoneTitle.trim()) return;
    setError(null);
    setConfirmation(null);
    startTransition(async () => {
      const result = await bulkAssignMilestone([...selected], {
        title: milestoneTitle,
        targetDate: milestoneTargetDate || undefined,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setConfirmation(t("bulkAssignMilestoneConfirmation", { count: result.assigned }));
        setSelected(new Set());
        setMilestoneTitle("");
        setMilestoneTargetDate("");
      }
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div
          className="no-print"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "rgba(0,201,167,0.08)",
            border: "1px solid rgba(0,201,167,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
              {t("bulkAssignSelectedCount", { count: selected.size })}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              {t("bulkAssignClearSelection")}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 90 }}>{t("bulkAssignAssessmentLabel")}</span>
            <select
              value={assessmentSlug}
              onChange={(e) => setAssessmentSlug(e.target.value)}
              disabled={isPending}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12.5,
                color: "var(--text)",
                cursor: "pointer",
                minWidth: 200,
              }}
            >
              {assignable.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name} — {a.level}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={assessmentDueDate}
              onChange={(e) => setAssessmentDueDate(e.target.value)}
              disabled={isPending}
              title={t("bulkAssignAssessmentDueDateLabel")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12.5,
                color: "var(--text)",
              }}
            />
            <button
              type="button"
              disabled={isPending}
              onClick={handleBulkAssign}
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "7px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? t("bulkAssignAssigning") : t("bulkAssignButton")}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 90 }}>{t("bulkAssignMilestoneLabel")}</span>
            <input
              type="text"
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              disabled={isPending}
              placeholder={t("bulkAssignMilestoneTitlePlaceholder")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12.5,
                color: "var(--text)",
                minWidth: 200,
                flex: "1 1 200px",
              }}
            />
            <input
              type="date"
              value={milestoneTargetDate}
              onChange={(e) => setMilestoneTargetDate(e.target.value)}
              disabled={isPending}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12.5,
                color: "var(--text)",
              }}
            />
            <button
              type="button"
              disabled={isPending || !milestoneTitle.trim()}
              onClick={handleBulkAssignMilestone}
              style={{
                background: "var(--teal)",
                color: "#0A0F1E",
                border: "none",
                borderRadius: 8,
                padding: "7px 16px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: isPending || !milestoneTitle.trim() ? "not-allowed" : "pointer",
                opacity: isPending || !milestoneTitle.trim() ? 0.6 : 1,
              }}
            >
              {isPending ? t("bulkAssignAssigning") : t("bulkAssignButton")}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#f87171", fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
      {confirmation && <p style={{ color: "var(--teal)", fontSize: 12.5, marginBottom: 10 }}>{confirmation}</p>}

      <div style={{ background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...headStyle, textAlign: "center", width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t("bulkAssignSelectAllAria")} />
                </th>
                <th style={{ ...headStyle, textAlign: "start" }}>{t("tableName")}</th>
                <th style={{ ...headStyle, textAlign: "start" }}>{t("tableTitle")}</th>
                <th style={{ ...headStyle, textAlign: "start" }}>{t("tableDepartment")}</th>
                <th style={{ ...headStyle, textAlign: "start" }}>{t("tableCountry")}</th>
                <th style={{ ...headStyle, textAlign: "start" }}>{t("tableEmail")}</th>
                <th style={{ ...headStyle, textAlign: "end" }}>{t("tableCareerHealthScore")}</th>
                <th style={{ ...headStyle, textAlign: "end" }} title={t("tableRatingTooltip")}>{t("tableRating")}</th>
                <th style={{ ...headStyle, textAlign: "end" }}>{t("tableAssessments")}</th>
                <th style={{ ...headStyle, textAlign: "end" }}>{t("tablePlans")}</th>
                <th style={{ ...headStyle, textAlign: "end" }}>{t("tableMilestones")}</th>
                <th style={{ ...headStyle, textAlign: "end" }} aria-label={t("tableActionsAria")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.userId)}
                      onChange={() => toggleRow(r.userId)}
                      aria-label={t("bulkAssignSelectRowAria", { name: r.name })}
                    />
                  </td>
                  <td style={cellStyle}>
                    <Link
                      href={`/dashboard/company/${r.userId}`}
                      style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}
                    >
                      <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                      <span style={{ textDecoration: "underline", textDecorationColor: "var(--border)" }}>{r.name}</span>
                    </Link>
                  </td>
                  <td style={{ ...cellStyle, color: r.title ? "var(--text)" : "var(--text-muted)" }}>{r.title ?? "—"}</td>
                  <td style={{ ...cellStyle, color: r.department ? "var(--text)" : "var(--text-muted)" }}>{r.department ?? "—"}</td>
                  <td style={{ ...cellStyle, color: r.country ? "var(--text)" : "var(--text-muted)" }}>{r.country ?? "—"}</td>
                  <td style={cellStyle}>{r.email}</td>
                  <td style={{ ...cellStyle, textAlign: "end", color: "var(--teal)", fontWeight: 700 }}>{r.careerHealthScore ?? "—"}</td>
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "end",
                      color: r.performanceRating ? "var(--amber)" : "var(--text-muted)",
                      fontWeight: r.performanceRating ? 700 : 400,
                    }}
                  >
                    {r.performanceRating ? `${r.performanceRating}/5` : "—"}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "end" }}>{r.assessmentsCompleted}</td>
                  <td style={{ ...cellStyle, textAlign: "end" }}>{r.plans}</td>
                  <td style={{ ...cellStyle, textAlign: "end" }}>
                    {r.milestonesDone}/{r.milestonesTotal}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "end", whiteSpace: "nowrap" }}>
                    <Link
                      href={`/dashboard/company/${r.userId}#assign-task`}
                      style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", textDecoration: "none", marginInlineEnd: 14 }}
                    >
                      {t("assignTaskLink")}
                    </Link>
                    <EditEmployeeButton
                      memberId={r.memberId}
                      userId={r.userId}
                      name={r.name}
                      role={r.role}
                      isSelf={r.userId === currentUserId}
                      pendingDataDeletionAt={r.pendingDataDeletionAt}
                      performanceRating={r.performanceRating}
                      performanceRatingNote={r.performanceRatingNote}
                      initial={{
                        title: r.title,
                        department: r.department,
                        country: r.country,
                        managerName: r.managerName,
                        managerEmail: r.managerEmail,
                        businessUnit: r.businessUnit,
                        location: r.location,
                        employeeId: r.employeeId,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
