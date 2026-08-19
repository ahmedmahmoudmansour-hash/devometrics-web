import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { getReviewExportData } from "@/lib/performanceReviews/actions";
import { reviewStatusLabel, competencyRatingLabel, goalStatusLabel, type ReviewStatus, type GoalStatus } from "@/lib/performanceReviews/types";

// HR-only. Ahmed was explicit: the employee and their manager should not
// get this export — only an org admin. getReviewExportData already
// enforces that server-side (buildCompanyData().isOrgAdmin), so this route
// has no separate auth path of its own to keep in sync — a caller who
// isn't an org admin simply gets { error } back and a 403 here, the same
// single source of truth every other admin-gated action in this app uses.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getReviewExportData(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.error === "Not authorized" ? 403 : 404 });
  const { data } = result;

  // Plain English labels (not next-intl) — same posture as the JD/Plan
  // docx exports, and reviewStatusLabel/competencyRatingLabel/goalStatusLabel
  // just need a (key: string) => string function, so a tiny local English
  // dictionary stands in for a full translator here.
  const EN: Record<string, string> = {
    "reviewStatus.not_started": "Not started",
    "reviewStatus.self_submitted": "Reflection submitted",
    "reviewStatus.manager_submitted": "Manager's Perspective shared",
    "reviewStatus.acknowledged": "Confirmed",
    "reviewStatus.closed": "Closed",
    "competencyRating.1": "1 — Needs development",
    "competencyRating.2": "2 — Developing",
    "competencyRating.3": "3 — Meets expectations",
    "competencyRating.4": "4 — Exceeds expectations",
    "competencyRating.5": "5 — Outstanding",
    "goalStatus.not_started": "Not started",
    "goalStatus.in_progress": "In progress",
    "goalStatus.achieved": "Achieved",
    "goalStatus.missed": "Missed",
  };
  const tEn = (key: string) => EN[key] ?? key;

  function heading(text: string): Paragraph {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 80 }, children: [new TextRun({ text })] });
  }
  function body(text: string): Paragraph {
    return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 22 })] });
  }
  function bullet(text: string): Paragraph {
    return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text, size: 22 })] });
  }
  function labelValue(label: string, value: string): Paragraph {
    return new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `${label}: `, bold: true, size: 22 }), new TextRun({ text: value, size: 22 })],
    });
  }

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "DEVOMETRICS", bold: true, color: "3f7a67", size: 20 })],
    }),
    new Paragraph({ text: data.cycleName, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [new TextRun({ text: `${data.employeeName} · ${reviewStatusLabel(tEn, data.status as ReviewStatus)}`, color: "666666", size: 20 })],
    }),
  ];

  if (data.self) {
    children.push(heading("Self-Assessment"));
    if (data.self.rating !== null) children.push(labelValue("Self-rating", competencyRatingLabel(tEn, data.self.rating)));
    if (data.self.reflection) children.push(body(data.self.reflection));
    if (data.self.key_strengths) {
      children.push(labelValue("Key Strengths", ""));
      children.push(body(data.self.key_strengths));
    }
    if (data.self.recommendations) {
      children.push(labelValue("Recommendations", ""));
      children.push(body(data.self.recommendations));
    }
    if (data.self.development_areas) {
      children.push(labelValue("Development Areas", ""));
      children.push(body(data.self.development_areas));
    }
  }

  if (data.manager) {
    children.push(heading("Manager's Perspective"));
    if (data.managerName) children.push(labelValue("Manager", data.managerName));
    if (data.manager.rating !== null) children.push(labelValue("Manager rating", competencyRatingLabel(tEn, data.manager.rating)));
    if (data.manager.feedback) children.push(body(data.manager.feedback));
    if (data.manager.development_needs) {
      children.push(labelValue("Development Needs", ""));
      children.push(body(data.manager.development_needs));
    }
  }

  if (data.competencyRatings.length > 0) {
    children.push(heading("Competency Ratings"));
    for (const r of data.competencyRatings) {
      const label = r.organization_competency_id ? (r.organizationCompetencyName ?? "Competency") : (r.dimension ?? "Competency");
      const managerPart = r.rating !== null ? `Manager: ${competencyRatingLabel(tEn, r.rating)}` : "Manager: not yet rated";
      const selfPart = r.self_rating !== null ? `Self: ${competencyRatingLabel(tEn, r.self_rating)}` : null;
      children.push(bullet(`${label} — ${[selfPart, managerPart].filter(Boolean).join(" · ")}`));
    }
  }

  if (data.goals.length > 0) {
    children.push(heading("Goals"));
    for (const g of data.goals) {
      const parts = [g.title, `(${goalStatusLabel(tEn, g.status as GoalStatus)})`];
      children.push(bullet(parts.join(" ")));
      if (g.description) children.push(body(g.description));
    }
  }

  const signedOffSignoffs = data.uplineSignoffs.filter((s) => s.signed_off_at !== null);
  if (signedOffSignoffs.length > 0) {
    children.push(heading("Department Head Review"));
    for (const s of signedOffSignoffs) {
      children.push(labelValue(s.managerName ?? "Department Head", s.comment ?? ""));
    }
  }

  if (data.conclusion) {
    children.push(heading("Conclusion"));
    children.push(body(data.conclusion));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const safeName = `${data.employeeName}-${data.cycleName}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "performance-review";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}.docx"`,
    },
  });
}
