import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { requireAdmin } from "@/lib/jobArchitecture/actions";

const SECTION_HEADINGS = new Set(["Responsibilities", "Requirements", "Nice to have"]);

// The saved JD is a single flattened string (title, blank line, summary,
// blank line, "Responsibilities" + "- " bullets, ...) — see formatJD() in
// lib/jobArchitecture/actions.ts. Re-parsing it line-by-line rather than
// persisting the structured GeneratedJD shape keeps the DB schema (one text
// column) unchanged and matches exactly what the admin sees/edits in the
// textarea, including any manual edits made after generation.
function buildJdParagraphs(title: string, body: string): Paragraph[] {
  const lines = body.split("\n");
  // First line duplicates the role title (formatJD's own first line) — the
  // title already renders as its own heading below, so skip it here.
  const rest = lines[0]?.trim() === title.trim() ? lines.slice(1) : lines;

  const children: Paragraph[] = [];
  for (const raw of rest) {
    const line = raw.trim();
    if (!line) continue;
    if (SECTION_HEADINGS.has(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 80 },
          children: [new TextRun({ text: line })],
        })
      );
    } else if (line.startsWith("- ")) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text: line.slice(2), size: 22 })],
        })
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: line, size: 22 })],
        })
      );
    }
  }
  return children;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, organizationId } = await requireAdmin();
  if (!user || !organizationId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { data: role } = await supabase
    .from("job_roles")
    .select("title, level, generated_jd, job_families(name)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle<{ title: string; level: string | null; generated_jd: string | null; job_families: { name: string } | null }>();
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!role.generated_jd) return NextResponse.json({ error: "No job description generated yet" }, { status: 400 });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "DEVOMETRICS", bold: true, color: "3f7a67", size: 20 })],
    }),
    new Paragraph({
      text: role.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    ...(role.level || role.job_families?.name
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: [role.job_families?.name, role.level].filter(Boolean).join(" · "),
                color: "666666",
                size: 20,
              }),
            ],
          }),
        ]
      : []),
    ...buildJdParagraphs(role.title, role.generated_jd),
  ];

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  const safeName = role.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "job-description";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}.docx"`,
    },
  });
}
