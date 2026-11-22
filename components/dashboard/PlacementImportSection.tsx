"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { previewPlacements, commitPlacements, type PlacePreview } from "@/lib/jobArchitecture/place";
import type { PlaceRow } from "@/lib/jobArchitecture/placeCore";

const card: React.CSSProperties = { background: "var(--navy-mid)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 18 };
const btn: React.CSSProperties = { background: "var(--teal)", color: "#0A0F1E", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const ghost: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const ALIASES: Record<keyof PlaceRow, string[]> = {
  email: ["email", "employeeemail", "workemail", "mail", "emailaddress"],
  title: ["jobtitle", "title", "role", "position", "job", "jobname"],
  family: ["jobfamily", "family", "department", "dept"],
};
const REQUIRED: (keyof PlaceRow)[] = ["email", "title"];
const normalize = (h: unknown) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

// Put many people into their jobs from Excel or CSV: employee email + job title. The file is read here; the server checks every row
// again and writes only after the admin has seen the preview and pressed the button.
export default function PlacementImportSection() {
  const t = useTranslations("placeImport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PlaceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Exclude<PlacePreview, { error: string }> | null>(null);
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
      ["Employee email", "Job title", "Job family (only if two jobs share a title)"],
      ["name@yourcompany.com", "Customer Service Manager", ""],
      ["another@yourcompany.com", "Customer Service Agent", ""],
    ]);
    sheet["!cols"] = [{ wch: 30 }, { wch: 32 }, { wch: 40 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "People and jobs");
    XLSX.writeFile(book, "people-and-jobs-template.xlsx");
  }

  async function handleFile(file: File | undefined) {
    setError(null);
    setDone(null);
    setPreview(null);
    setRows([]);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError(t("fileTooLarge"));
    setFileName(file.name);
    let parsed: PlaceRow[];
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false });
      if (matrix.length < 2) return setError(t("noRows"));
      const headers = (matrix[0] as unknown[]).map(normalize);
      const col = {} as Record<keyof PlaceRow, number>;
      for (const f of Object.keys(ALIASES) as (keyof PlaceRow)[]) col[f] = headers.findIndex((h) => ALIASES[f].includes(h));
      const missing = REQUIRED.filter((f) => col[f] === -1);
      if (missing.length) return setError(t("missingColumns", { columns: missing.map((m) => t(`col_${m}`)).join(", ") }));
      const at = (r: unknown[], f: keyof PlaceRow) => (col[f] === -1 ? "" : cell(r[col[f]]));
      parsed = (matrix.slice(1) as unknown[][]).map((r) => ({ email: at(r, "email"), title: at(r, "title"), family: at(r, "family") }));
    } catch {
      return setError(t("unreadable"));
    }
    setRows(parsed);
    startTransition(async () => {
      const result = await previewPlacements(parsed);
      if ("error" in result) setError(result.error);
      else setPreview(result);
    });
  }

  function importNow() {
    setError(null);
    startTransition(async () => {
      const result = await commitPlacements(rows);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(t("importedSuccess", { placed: result.placed, skipped: result.skipped, failed: result.failed }));
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
          <button type="button" onClick={() => setOpen(true)} style={btn}>{t("openButton")}</button>
        </div>
        {done && <p role="status" style={{ color: "var(--teal)", fontSize: 13, marginTop: 12 }}>{done}</p>}
      </div>
    );
  }

  const colour = (s: string) => (s === "ok" ? "var(--teal)" : s === "unchanged" ? "var(--text-muted)" : "var(--danger)");
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
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 10 }}>
            <strong>{fileName}</strong> — {t("summary", { ok: preview.ok, unchanged: preview.unchanged, errors: preview.errors })}
          </p>
          <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["#", t("col_email"), t("col_title"), t("result")].map((h, i) => <th key={i} style={{ padding: "8px 10px", textAlign: "start" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const res = preview.results[i];
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{i + 2}</td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}><bdi>{r.email}</bdi></td>
                      <td style={{ padding: "6px 10px", color: "var(--text)" }}><bdi>{r.title}</bdi></td>
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
          </div>
        </>
      )}
    </div>
  );
}
