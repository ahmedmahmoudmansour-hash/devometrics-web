"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { previewAttendanceImport, commitAttendanceImport, type AttendanceImportRow, type AttendanceImportRowResult } from "@/lib/attendance/import";

const cardStyle: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 };
const btnPrimary: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };

const MAX_FILE_BYTES = 4 * 1024 * 1024;

const HEADER_ALIASES: Record<keyof AttendanceImportRow, string[]> = {
  employeeEmail: ["email", "employeeemail", "employee", "workemail"],
  date: ["date", "day", "workdate", "attendancedate"],
  status: ["status", "attendance", "type"],
  checkIn: ["checkin", "in", "timein", "clockin", "arrival", "start"],
  checkOut: ["checkout", "out", "timeout", "clockout", "departure", "end"],
  notes: ["notes", "note", "comment", "comments", "remarks"],
};

const REQUIRED: (keyof AttendanceImportRow)[] = ["employeeEmail", "date"];

function normalizeHeader(h: unknown): string {
  return String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Excel stores a date as a day count (1900 system) and a time as the
// fraction of a day; both are converted in UTC so nothing shifts with the
// viewer's timezone. Anything that is already text is passed through and the
// server decides whether it is valid.
function cellToText(value: unknown, kind: "text" | "date" | "time"): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (kind === "date") return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
    if (kind === "time") {
      const minutes = Math.round((value - Math.floor(value)) * 1440) % 1440;
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
  }
  return String(value).trim();
}

export default function AttendanceImportSection({ organizationId }: { organizationId: string }) {
  const t = useTranslations("attendanceImport");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AttendanceImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ results: AttendanceImportRowResult[]; ok: number; duplicates: number; errors: number } | null>(null);
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
      ["Employee email", "Date", "Status", "Check in", "Check out", "Notes"],
      ["name@yourcompany.com", "2026-03-01", "present", "09:05", "17:30", ""],
      ["name@yourcompany.com", "2026-03-02", "absent", "", "", "Sick"],
    ]);
    sheet["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendance");
    XLSX.writeFile(book, "attendance-import-template.xlsx");
  }

  async function handleFile(file: File | undefined) {
    setError(null);
    setDone(null);
    setPreview(null);
    setRows([]);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError(t("fileTooLarge"));

    setFileName(file.name);
    let parsed: AttendanceImportRow[];
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, blankrows: false });
      if (matrix.length < 2) return setError(t("noRows"));

      const headers = (matrix[0] as unknown[]).map(normalizeHeader);
      const colFor = {} as Record<keyof AttendanceImportRow, number>;
      const missing: string[] = [];
      for (const field of Object.keys(HEADER_ALIASES) as (keyof AttendanceImportRow)[]) {
        colFor[field] = headers.findIndex((h) => HEADER_ALIASES[field].includes(h));
        if (colFor[field] === -1 && REQUIRED.includes(field)) missing.push(field);
      }
      if (missing.length) return setError(t("missingColumns", { columns: missing.map((m) => t(`col_${m}`)).join(", ") }));

      const cell = (r: unknown[], f: keyof AttendanceImportRow, kind: "text" | "date" | "time") => (colFor[f] === -1 ? "" : cellToText(r[colFor[f]], kind));
      parsed = (matrix.slice(1) as unknown[][]).map((r) => ({
        employeeEmail: cell(r, "employeeEmail", "text"),
        date: cell(r, "date", "date"),
        status: cell(r, "status", "text"),
        checkIn: cell(r, "checkIn", "time"),
        checkOut: cell(r, "checkOut", "time"),
        notes: cell(r, "notes", "text"),
      }));
    } catch {
      return setError(t("unreadable"));
    }

    setRows(parsed);
    startTransition(async () => {
      const result = await previewAttendanceImport(organizationId, parsed);
      if ("error" in result) setError(result.error);
      else setPreview(result);
    });
  }

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const result = await commitAttendanceImport(organizationId, rows);
      if ("error" in result) setError(result.error);
      else {
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

  const statusColor = (s: AttendanceImportRowResult["status"]) => (s === "ok" ? "var(--teal)" : s === "duplicate" ? "var(--text-muted)" : "var(--danger)");
  const th: React.CSSProperties = { padding: "8px 10px", textAlign: "start" };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h2>
        <button type="button" onClick={() => { reset(); setOpen(false); }} style={btnGhost}>
          {t("close")}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10, maxWidth: 640 }}>{t("description")}</p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14 }}>{t("columnsHint")}</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={downloadTemplate} style={{ ...btnPrimary, background: "rgba(255,255,255,0.08)", color: "var(--text)" }}>
          {t("downloadTemplate")}
        </button>
        <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0])} style={{ fontSize: 13, color: "var(--text-muted)" }} aria-label={t("chooseFile")} />
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
                <tr style={{ color: "var(--text-muted)" }}>
                  <th style={th}>#</th>
                  <th style={th}>{t("col_employeeEmail")}</th>
                  <th style={th}>{t("col_date")}</th>
                  <th style={th}>{t("col_status")}</th>
                  <th style={th}>{t("times")}</th>
                  <th style={th}>{t("result")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const res = preview.results[i];
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{i + 2}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.employeeEmail}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)", whiteSpace: "nowrap" }}>{r.date}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.status || "present"}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)", whiteSpace: "nowrap" }}>{r.checkIn || "—"} → {r.checkOut || "—"}</td>
                      <td style={{ padding: "6px 10px", color: statusColor(res.status) }}>{res.status === "ok" ? t("statusOk") : res.message}</td>
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
