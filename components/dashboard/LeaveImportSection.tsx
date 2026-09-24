"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { previewLeaveImport, commitLeaveImport, type LeaveImportRow, type LeaveImportRowResult } from "@/lib/leave/import";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const btnPrimary: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };

const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Header names people actually use -> our field. Compared after stripping
// everything but letters/digits, so "Start Date", "start_date" and
// "START-DATE" all match.
const HEADER_ALIASES: Record<keyof LeaveImportRow, string[]> = {
  employeeEmail: ["email", "employeeemail", "employee", "workemail"],
  leaveTypeName: ["leavetype", "type", "vacationtype", "leave"],
  startDate: ["startdate", "start", "from", "fromdate"],
  endDate: ["enddate", "end", "to", "todate"],
  days: ["days", "numberofdays", "daystaken", "duration"],
  reason: ["reason", "notes", "note", "comment", "comments"],
};

function normalizeHeader(h: unknown): string {
  return String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Excel stores dates as serial day counts (1900 system, with the 1900 leap
// bug baked into the 25569 epoch offset). Computed in UTC so the result
// never shifts a day with the viewer's timezone.
function cellToText(value: unknown, isDateField: boolean): string {
  if (value === null || value === undefined) return "";
  if (isDateField && typeof value === "number" && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export default function LeaveImportSection({ organizationId, leaveTypeNames }: { organizationId: string; leaveTypeNames: string[] }) {
  const t = useTranslations("leaveImport");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LeaveImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ results: LeaveImportRowResult[]; ok: number; duplicates: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setPreview(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Employee email", "Leave type", "Start date", "End date", "Days", "Reason"],
      ["name@yourcompany.com", leaveTypeNames[0] ?? "Annual Leave", "2026-03-01", "2026-03-05", 5, "Family trip"],
    ]);
    sheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 28 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Leave");
    XLSX.writeFile(book, "leave-import-template.xlsx");
  }

  async function handleFile(file: File | undefined) {
    setError(null);
    setDone(null);
    setPreview(null);
    setRows([]);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError(t("fileTooLarge"));

    setFileName(file.name);
    let parsed: LeaveImportRow[];
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false });
      if (matrix.length < 2) return setError(t("noRows"));

      const headers = (matrix[0] as unknown[]).map(normalizeHeader);
      const colFor = {} as Record<keyof LeaveImportRow, number>;
      const missing: string[] = [];
      for (const field of Object.keys(HEADER_ALIASES) as (keyof LeaveImportRow)[]) {
        colFor[field] = headers.findIndex((h) => HEADER_ALIASES[field].includes(h));
        if (colFor[field] === -1 && field !== "reason") missing.push(field);
      }
      if (missing.length) return setError(t("missingColumns", { columns: missing.map((m) => t(`col_${m}`)).join(", ") }));

      parsed = (matrix.slice(1) as unknown[][]).map((r) => ({
        employeeEmail: cellToText(r[colFor.employeeEmail], false),
        leaveTypeName: cellToText(r[colFor.leaveTypeName], false),
        startDate: cellToText(r[colFor.startDate], true),
        endDate: cellToText(r[colFor.endDate], true),
        days: cellToText(r[colFor.days], false),
        reason: colFor.reason === -1 ? "" : cellToText(r[colFor.reason], false),
      }));
    } catch {
      return setError(t("unreadable"));
    }

    setRows(parsed);
    startTransition(async () => {
      const result = await previewLeaveImport(organizationId, parsed);
      if ("error" in result) setError(result.error);
      else setPreview(result);
    });
  }

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const result = await commitLeaveImport(organizationId, rows);
      if ("error" in result) {
        setError(result.error);
      } else {
        setDone(t("importedSuccess", { imported: result.imported, skipped: result.skipped }));
        reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <div style={cardStyle}>
        <button type="button" onClick={() => setOpen(true)} style={btnPrimary}>
          + {t("openButton")}
        </button>
        {done && <p style={{ color: "var(--teal)", fontSize: 13, marginTop: 12 }}>{done}</p>}
      </div>
    );
  }

  const statusColor = (s: LeaveImportRowResult["status"]) => (s === "ok" ? "var(--teal)" : s === "duplicate" ? "var(--text-muted)" : "var(--danger)");

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h2>
        <button type="button" onClick={() => { reset(); setOpen(false); }} style={btnGhost}>
          {t("close")}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14, maxWidth: 640 }}>{t("description")}</p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14 }}>
        {t("columnsHint")}{" "}
        {leaveTypeNames.length > 0 && <>{t("typesHint", { types: leaveTypeNames.join(", ") })}</>}
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={downloadTemplate} style={{ ...btnPrimary, background: "rgba(255,255,255,0.08)", color: "var(--text)" }}>
          {t("downloadTemplate")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
          style={{ fontSize: 13, color: "var(--text-muted)" }}
          aria-label={t("chooseFile")}
        />
      </div>

      {isPending && !preview && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("checking")}</p>}
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {preview && (
        <>
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 10 }}>
            <strong>{fileName}</strong> — {t("summary", { ok: preview.ok, duplicates: preview.duplicates, errors: preview.errors })}
          </p>
          <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "start", color: "var(--text-muted)" }}>
                  <th style={{ padding: "8px 10px", textAlign: "start" }}>#</th>
                  <th style={{ padding: "8px 10px", textAlign: "start" }}>{t("col_employeeEmail")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "start" }}>{t("col_leaveTypeName")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "start" }}>{t("dates")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "start" }}>{t("col_days")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "start" }}>{t("result")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const res = preview.results[i];
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{i + 2}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.employeeEmail}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.leaveTypeName}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)", whiteSpace: "nowrap" }}>{r.startDate} → {r.endDate}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.days}</td>
                      <td style={{ padding: "6px 10px", color: statusColor(res.status) }}>
                        {res.status === "ok" ? t("statusOk") : res.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button type="button" disabled={isPending || preview.ok === 0} onClick={handleImport} style={{ ...btnPrimary, opacity: isPending || preview.ok === 0 ? 0.5 : 1 }}>
              {isPending ? t("importing") : t("importButton", { count: preview.ok })}
            </button>
            <button type="button" onClick={reset} style={btnGhost}>
              {t("startOver")}
            </button>
            {(preview.errors > 0 || preview.duplicates > 0) && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("skipNote")}</span>}
          </div>
        </>
      )}
    </div>
  );
}
