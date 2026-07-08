import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".doc"] as const;
export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export class UnsupportedFileError extends Error {}
export class EmptyExtractionError extends Error {}

// Handles real text-layer PDFs, modern DOCX, and legacy OLE-based DOC files.
// Older CVs (or ones exported from older Word versions/LinkedIn) often come
// as plain .doc, not .docx — mammoth only reads the modern format, so a
// separate parser (word-extractor) is used for the legacy one rather than
// silently rejecting it and forcing a copy-paste fallback. Does not handle
// scanned/image-only PDFs (no OCR) — that's a genuinely different, heavier
// problem, not something silently unsupported by accident.
export async function extractTextFromFile(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();

  let text: string;
  if (lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
  } else if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (lower.endsWith(".doc")) {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    text = doc.getBody();
  } else {
    throw new UnsupportedFileError("Only .pdf, .doc, and .docx files are supported");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new EmptyExtractionError(
      "No text could be extracted — this may be a scanned/image-only PDF with no real text layer"
    );
  }
  return trimmed;
}
