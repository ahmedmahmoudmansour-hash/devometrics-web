import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractTextFromFile,
  UnsupportedFileError,
  EmptyExtractionError,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/fileExtraction/extract";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB)` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const text = await extractTextFromFile(buffer, file.name);
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof UnsupportedFileError) {
      return NextResponse.json({ error: "Only .pdf, .doc, and .docx files are supported" }, { status: 400 });
    }
    if (err instanceof EmptyExtractionError) {
      return NextResponse.json(
        { error: "No text found in this file — it may be a scanned/image-only document. Try pasting the text directly instead." },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Failed to read file — please try again" }, { status: 500 });
  }
}
