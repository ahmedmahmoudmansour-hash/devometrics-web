"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { previewRolesImport, commitRolesImport, type RolesImportPreview } from "@/lib/jobArchitecture/import";
import type { RolesImportRow } from "@/lib/jobArchitecture/importCore";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 18 };
const btn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const ghost: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };

const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Header names people actually use -> our field. Compared after stripping everything but letters and digits.
const ALIASES: Record<keyof RolesImportRow, string[]> = {
  family: ["family", "jobfamily", "department", "function", "group", "dept"],
  title: ["title", "jobtitle", "role", "position", "jobname", "name"],
  level: ["level", "joblevel", "levellabel", "band", "seniority"],
  grade: ["grade", "gradenumber", "jobgrade", "gradelevel"],
  track: ["track", "ladder", "path", "tracktype", "careertrack"],
  responsibilities: ["responsibilities", "description", "summary", "notes", "jobdescription"],
};
const REQUIRED: (keyof RolesImportRow)[] = ["title", "grade"];

const normalize = (h: unknown) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

// Upload the company's own job titles and levels from Excel or CSV. The file is read here; the server checks every row again
// and writes only after the admin has seen the preview and pressed the button.
export default function RolesImportSection() {
  const t = useTranslations("rolesImport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RolesImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Exclude<RolesImportPreview, { error: string }> | null>(null);
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
      ["Job family", "Job title", "Level", "Grade", "Track", "Responsibilities"],
      ["Customer Service", "Customer Service Agent", "Entry", 2, "IC", "Answers customers by phone, email and chat."],
      ["Customer Service", "Senior Customer Service Agent", "Senior", 4, "IC", ""],
      ["Customer Service", "Customer Service Manager", "Manager", 6, "Management", "Leads the service team and its results."],
    ]);
    sheet["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 40 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Job titles");
    XLSX.writeFile(book, "job-titles-and-levels-template.xlsx");
  }

  async function handleFile(file: File | undefined) {
    setError(null);
    setDone(null);
    setPreview(null);
    setRows([]);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError(t("fileTooLarge"));
    setFileName(file.name);
    let parsed: RolesImportRow[];
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false });
      if (matrix.length < 2) return setError(t("noRows"));
      const headers = (matrix[0] as unknown[]).map(normalize);
      const col = {} as Record<keyof RolesImportRow, number>;
      for (const f of Object.keys(ALIASES) as (keyof RolesImportRow)[]) col[f] = headers.findIndex((h) => ALIASES[f].includes(h));
      const missing = REQUIRED.filter((f) => col[f] === -1);
      if (missing.length) return setError(t("missingColumns", { columns: missing.map((m) => t(`col_${m}`)).join(", ") }));
      const at = (r: unknown[], f: keyof RolesImportRow) => (col[f] === -1 ? "" : cell(r[col[f]]));
      parsed = (matrix.slice(1) as unknown[][]).map((r) => ({ family: at(r, "family"), title: at(r, "title"), level: at(r, "level"), grade: at(r, "grade"), track: at(r, "track"), responsibilities: at(r, "responsibilities") }));
    } catch {
      return setError(t("unreadable"));
    }
    setRows(parsed);
    startTransition(async () => {
      const result = await previewRolesImport(parsed);
      if ("error" in result) setError(result.error);
      else setPreview(result);
    });
  }

  function importNow() {
    setError(null);
    startTransition(async () => {
      const result = await commitRolesImport(rows);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(t("importedSuccess", { roles: result.rolesCreated, families: result.familiesCreated, skipped: result.skipped }));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div style={card}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5, maxWidth: 620 }}>{t("teaser")}</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} style={btn}>
            {t("openButton")}
          </button>
        </div>
        {done && <p role="status" style={{ color: "var(--teal)", fontSize: 13, marginTop: 12 }}>{done}</p>}
      </div>
    );
  }

  const colour = (s: string) => (s === "ok" ? "var(--teal)" : s === "duplicate" ? "var(--text-muted)" : "var(--danger)");
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t("title")}</h2>
        <button type="button" onClick={() => { reset(); setOpen(false); }} style={ghost}>{t("close")}</button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10, maxWidth: 680 }}>{t("description")}</p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14 }}>{t("columnsHint")}</p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={downloadTemplate} style={{ ...btn, background: "rgba(255,255,255,0.08)", color: "var(--text)" }}>{t("downloadTemplate")}</button>
        <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void handleFile(e.target.files?.[0])} style={{ fontSize: 13, color: "var(--text-muted)" }} aria-label={t("chooseFile")} />
      </div>
      {pending && !preview && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("checking")}</p>}
      {error && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {preview && (
        <>
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>
            <strong>{fileName}</strong> — {t("summary", { ok: preview.ok, duplicates: preview.duplicates, errors: preview.errors })}
          </p>
          {preview.newFamilies.length > 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{t("newFamilies", { count: preview.newFamilies.length, names: preview.newFamilies.slice(0, 6).join(", ") })}</p>}
          <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["#", t("col_family"), t("col_title"), t("col_level"), t("col_grade"), t("col_track"), t("result")].map((h, i) => <th key={i} style={{ padding: "8px 10px", textAlign: "start" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const res = preview.results[i];
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{i + 2}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}><bdi>{r.family}</bdi></td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}><bdi>{r.title}</bdi></td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}><bdi>{r.level}</bdi></td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.grade}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}>{r.track}</td>
                      <td style={{ padding: "6px 10px", color: colour(res.status) }}>{res.status === "ok" ? t("statusOk") : res.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" disabled={pending || preview.ok === 0} onClick={importNow} style={{ ...btn, opacity: pending || preview.ok === 0 ? 0.5 : 1 }}>
              {pending ? t("importing") : t("importButton", { count: preview.ok })}
            </button>
            <button type="button" onClick={reset} style={ghost}>{t("startOver")}</button>
            {(preview.errors > 0 || preview.duplicates > 0) && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("skipNote")}</span>}
          </div>
        </>
      )}
    </div>
  );
}
