import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type XlsxSheet = {
  name: string;
  rows: Record<string, unknown>[];
  /** Column widths in characters, in row-object key order. */
  colWidths?: number[];
};

// Was duplicated verbatim (with drift already visible between routes) across
// every export/*/xlsx route — one place for the workbook-building,
// filename-sanitizing, and response-header boilerplate they all shared.
export function sanitizeExportFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildXlsxResponse(sheets: XlsxSheet[], filenameBase: string): NextResponse {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    if (sheet.colWidths) {
      worksheet["!cols"] = sheet.colWidths.map((wch) => ({ wch }));
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const safeName = sanitizeExportFilename(filenameBase);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${safeName}-${dateSuffix}.xlsx"`,
    },
  });
}
